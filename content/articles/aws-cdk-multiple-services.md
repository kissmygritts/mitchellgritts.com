---
title: "Notes: Multiple Services ECS Deployment with the AWS CDK"
publishedOn: 2021-08-30
updatedOn: 2020-08-30
isPublished: true
category: aws
tags: [notes, infrastructure, aws]
description: "Notes on how I deployed multiple services to AWS ECS using the AWS CDK IaC toolkit."
---

In a [previous post](aws-cdk-simple-ecs-deployment) I deployed a single service to AWS ECS using the CDK. In this post I'll describe how to deploy multiple services to an ECS cluster. A few additional features of this CDK stack include:

* A single load balancer routing traffic to each service
* A CloudMap namespace for service discovery
* Everything will be served via HTTPS with my own domain

[Here is the repo for this example.](https://github.com/kissmygritts/aws-cdk-examples/tree/main/ecs-fargate-multiple-services)

## Initial setup

The services for this example are very similar to the services in the previous post. The main exception is `service1` and `service2` each have a route that will fetch data from each other. I used this as a way to test the service discovery mechanisms provided by AWS CloudMap. The services are essentially duplicated and configured to work in this example. See this repo for the example services.

## CDK

The base infrastructure for this example is similar to the previous example. We'll add the CloudMap namespace, and Route53 domain and certificate creation too. 

```js
const acm = require('@aws-cdk/aws-certificatemanager')
const ec2 = require('@aws-cdk/aws-ec2')
const ecs = require('@aws-cdk/aws-ecs')
const elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2')
const ecr = require('@aws-cdk/aws-ecr')
const route53 = require('@aws-cdk/aws-route53')
const route53Targets = require('@aws-cdk/aws-route53-targets')
const serviceDiscovery = require('@aws-cdk/aws-servicediscovery')
const cdk = require('@aws-cdk/core')

class EcsFargateMultipleServicesStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);
    
    /* BASE INFRASTRUCTURE */
		const vpc = new ec2.Vpc(this, 'VPC', { maxAzs: 2 })
		const cluster = new ecs.Cluster(this, 'Cluster', {
			clusterName: 'Services',
			vpc: vpc
		})    
		const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
			vpc: vpc,
			internetFacing: true,
			loadBalancerName: 'ServicesLB'
		})

    // services security group
    const servicesSecurityGroup = new ec2.SecurityGroup(this, 'servicesSecurityGroup', {
      vpc,
      allowAllOutbound: true
    })

    /* SERVICE DISCOVERY */
    const namespace = new serviceDiscovery.PrivateDnsNamespace(
      this,
      'serviceDiscoveryNamespace',
      {
        name: 'services',
        vpc
      }
    )

    /* DNS, DOMAINS, CERTS */
    // I'm using a domain I own: gritts.dev
    // be certain to register and use your own domain!
    const zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'gritts.dev'
    })

    const cert = new acm.Certificate(this, 'GrittsDev', {
      domainName: 'services.gritts.dev',
      subjectAlternativeNames: ['*.services.gritts.dev'],
      validation: acm.CertificateValidation.fromDns(zone)
    })

    // create DNS record to point to the load balancer
    new route53.ARecord(this, 'servicesSubdomain', {
      zone,
      recordName: 'services',
      target: route53.RecordTarget.fromAlias(
        new route53Targets.LoadBalancerTarget(alb)
      ),
      ttl: cdk.Duration.seconds(300),
      comment: 'services subdomain'
    })

    /* CONFIGURE ALB DEFAULT LISTENERS */
    // port 80 listener redirect to port 443
    const port80Listener = alb.addListener('port80Listener', { port: 80 })
    port80Listener.addAction('80to443Redirect', {
      action: elbv2.ListenerAction.redirect({
        port: '443',
        protocol: elbv2.Protocol.HTTPS,
        permanent: true
      })
    })

    const listener = alb.addListener('Listener', {
      open: true,
      port: 443,
      certificates: [cert]
    })

    // default listener action on `/` path
    listener.addAction('/', {
      action: elbv2.ListenerAction.fixedResponse(200, {
        contentType: 'application/json',
        messageBody: '{ "msg": "base route" }'
      })
    })

    /* DEFINE SERVICES */
    // service 1
    const repoOne = ecr.Repository.fromRepositoryArn(
      this,
      `EcrRepo1`,
      `arn:aws:ecr:us-west-2:${props.env.account}:repository/service1`
    )
    const taskOneImage = ecs.ContainerImage.fromEcrRepository(repoOne, 'latest')

    // task definition & service creation
    const serviceOneTaskDef = new ecs.FargateTaskDefinition(
      this,
      `ServiceOne_TaskDef`,
      {
        compatibility: ecs.Compatibility.EC2_AND_FARGATE,
        cpu: '256',
        memoryMiB: '512',
        networkMode: ecs.NetworkMode.AWS_VPC
      }
    )
    const serviceOneContainer = serviceOneTaskDef.addContainer('ServiceOne_Container', {
      containerName: 'ServiceOneContainer',
      image: taskOneImage,
      memoryLimitMiB: 512,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'service1' }),
      environment: {
        SERVICE_URL: 'http://service2.services:7072'
      }
    })
    serviceOneContainer.addPortMappings({
      containerPort: 7071,
      protocol: ecs.Protocol.TCP
    })
    const serviceOne = new ecs.FargateService(
      this,
      'ServiceOne',
      {
        cluster,
        taskDefinition: serviceOneTaskDef,
        serviceName: 'ServiceOne',
        securityGroups: [servicesSecurityGroup],
        cloudMapOptions: {
          name: 'service1',
          cloudMapNamespace: namespace,
          dnsRecordType: serviceDiscovery.DnsRecordType.A
        }
      }
    )

    serviceOne.connections.allowFrom(
      servicesSecurityGroup,
      ec2.Port.tcp(7071),
      'Allow traffic within security group on 7071'
    )

    // network with load balancer
    listener.addTargets('service1', {
      targetGroupName: 'ServiceOneTarget',
      port: 80,
      targets: [serviceOne],
      priority: 1,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/service1*'])],
      healthCheck: {
        interval: cdk.Duration.seconds(60),
        path: '/service1',
        timeout: cdk.Duration.seconds(5)
      }
    })

    // service 2
    const repoTwo = ecr.Repository.fromRepositoryArn(
      this,
      `EcrRepo2`,
      `arn:aws:ecr:us-west-2:${props.env.account}:repository/service2`
    )
    const taskTwoImage = ecs.ContainerImage.fromEcrRepository(repoTwo, 'latest')

    // task definition & service creation
    const serviceTwoTaskDef = new ecs.FargateTaskDefinition(
      this,
      'ServiceTwo_TaskDef',
      {
        compatibility: ecs.Compatibility.EC2_AND_FARGATE,
        cpu: '256',
        memoryMiB: '512',
        networkMode: ecs.NetworkMode.AWS_VPC
      }
    )
    const serviceTwoContianer = serviceTwoTaskDef.addContainer('ServiceTwo_Container', {
      containerName: 'ServiceTwoContainer',
      image: taskTwoImage,
      memoryLimitMiB: 512,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'service2' }),
      environment: {
        SERVICE_URL: 'http://service1.services:7071'
      }
    })
    serviceTwoContianer.addPortMappings({
      containerPort: 7072,
      protocol: ecs.Protocol.TCP
    })
    const serviceTwo = new ecs.FargateService(
      this,
      `ServiceTwo`,
      {
        cluster,
        taskDefinition: serviceTwoTaskDef,
        serviceName: 'ServiceTwo',
        securityGroups: [servicesSecurityGroup],
        cloudMapOptions: {
          name: 'service2',
          cloudMapNamespace: namespace,
          dnsRecordType: serviceDiscovery.DnsRecordType.A
        }
      }
    )

    serviceTwo.connections.allowFrom(
      servicesSecurityGroup,
      ec2.Port.tcp(7072),
      'Allow traffic within security group on 7072'
    )

    // network with load balancer
    listener.addTargets('service2', {
      targetGroupName: 'ServiceTwoTarget',
      port: 80,
      targets: [serviceTwo],
      priority: 2,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/service2*'])],
      healthCheck: {
        interval: cdk.Duration.seconds(60),
        path: '/service2',
        timeout: cdk.Duration.seconds(5)
      }
    })

    // create service 3
    const repoThree = ecr.Repository.fromRepositoryArn(
      this,
      `EcrRepo3`,
      `arn:aws:ecr:us-west-2:${props.env.account}:repository/service3`
    )
    const image3 = ecs.ContainerImage.fromEcrRepository(repoThree, 'latest')

    const serviceThreeTaskDef = new ecs.FargateTaskDefinition(
      this,
      'ServiceThree_TaskDef',
      {
        compatibility: ecs.Compatibility.EC2_AND_FARGATE,
        cpu: '256',
        memoryLimitMiB: '512',
        networkMode: ecs.NetworkMode.AWS_VPC
      }
    )
    const service3Container = serviceThreeTaskDef.addContainer('ServiceThree_Container', {
      containerName: 'ServiceThreeContainer',
      image: image3,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'service2' }),
    })
    service3Container.addPortMappings({
      containerPort: 7073,
      protocol: ecs.Protocol.TCP
    })

    const serviceThree = new ecs.FargateService(
      this,
      'ServiceThree',
      {
        cluster,
        taskDefinition: serviceThreeTaskDef,
        serviceName: 'ServiceThree',
        securityGroups: [servicesSecurityGroup],
        cloudMapOptions: {
          name: 'service3',
          cloudMapNamespace: namespace,
          dnsRecordType: serviceDiscovery.DnsRecordType.A
        }
      }
    )

    serviceThree.connections.allowFrom(
      servicesSecurityGroup,
      ec2.Port.tcp(7073),
      'Allow traffic within security group on 7073'
    )

    // network with load balancer
    listener.addTargets('service3', {
      targetGroupName: 'ServiceThreeTarget',
      port: 80,
      targets: [serviceThree],
      priority: 3,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/service3*'])],
      healthCheck: {
        interval: cdk.Duration.seconds(60),
        path: '/service3',
        timeout: cdk.Duration.seconds(5)
      }
    })
  }
}

module.exports = { EcsFargateMultipleServicesStack }
```

That is a lot of code. Let's break it down section by section.

### Base infrastructure

```js
/* BASE INFRASTRUCTURE */
const vpc = new ec2.Vpc(this, 'VPC', { maxAzs: 2 })
const cluster = new ecs.Cluster(this, 'Cluster', {
  clusterName: 'Services',
  vpc: vpc
})    
const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
  vpc: vpc,
  internetFacing: true,
  loadBalancerName: 'ServicesLB'
})

// services security group
const servicesSecurityGroup = new ec2.SecurityGroup(this,
  'servicesSecurityGroup', 
  {
    vpc,
    allowAllOutbound: true
  }
)

/* SERVICE DISCOVERY */
const namespace = new serviceDiscovery.PrivateDnsNamespace(
  this,
  'serviceDiscoveryNamespace',
  {
    name: 'services',
    vpc
  }
)
```

Again, similar to the previous post for the VPC, ECS cluster, and load balancer. We've added `serviceSecurityGroup` that will be used with all the services to allow service-to-service traffic. And a service discovery namespace to facilitate service-to-service traffic.

### Services

The services are similar to the services in the previous post. We've specified a few additional props:

* `logging` in the `.addContainer` method. We'll use the AWS log driver[^1] to send logs to AWS CloudWatch
* `environment` variables in `.addContainer` method. This allows us to provide runtime environment variables to the Docker container
* `securityGroups` in the `FargateService`. All the services will have the same security group.
* `cloudMapOptions` options to the `FargateService` this will register the service with CloudMap for service discovery. You can check that this works after deployment by navigating to the CloudMap console on AWS.

[^1]: This is the only log driver available for Fargate.

### Security groups

I always struggle with security groups. The CDK makes it easy(ish)! I don't know if this follows best practices or not? I've decided that all the services will share a single security group `servicesSecurityGroup`. 

After the security group is assigned to the service traffic as allowed within the security group on the specific ports with the `.connections.allowFrom` method.

When running `cdk deploy` (or `cdk diff`) the output to the terminal should include the necessary security groups and rules that will be added. It is a nice way to check your work.

### Path based routing

In this example infrastructure we've setup path based routing with the load balancer. Each service is a target for the load balancer. The load balancer will route traffic based on the conditions provided in the `conditions` prop.

See the code below for an example of `service3`:

```js
listener.addTargets('service1', {
	targetGroupName: 'ServiceOneTarget',
	port: 80,
	targets: [serviceOne],
	priority: 1,
	conditions:[
		elbv2.ListenerCondition.pathPatterns(['/service1*'])
	],
	healthCheck: {
		// change the healthcheck path
		path: '/service1',
		interval: cdk.Duration.seconds(60),
		timeout: cdk.Duration.seconds(5)
	}
})
```

[AWS ELB doesn't rewrite paths](https://serverfault.com/questions/876528/how-to-rewrite-paths-in-amazon-application-load-balancer) so each service must expose the appropriate routes.

## Troubleshooting

If you're anything like me you probably hit some roadblocks. Maybe I can offer some help:

* **You're building Docker images on an M1 mac?**: Make sure to build multi-platform images for Linux/amd64
	* https://docs.docker.com/buildx/working-with-buildx/#build-multi-platform-images
	* https://medium.com/nttlabs/buildx-multiarch-2c6c2df00ca2
* **You're trying to use Node 16 when building Docker images on an M1 mac?**: There appears to be a bug in Node 16, or Alpine, or Docker that causes the image building process to crash. **Revert to Node 14 (LTS)** to solve this problem.
* **`cdk deploy` crashes?**: Do your best to read the error message and make the necessary changes.
	* Maybe a resource already exists in AWS, that can cause a crash.
	* Did you replace `REGION` and `ACCOUNTID` in the example code with your own region and account ID?
* **You navigate to your services and don't see anything?**: this can be many things.
	* Are your security groups properly configured to allow traffic from the load balancer?
	* Are your security groups properly configured to allow service-to-service communication within the services security group?
	* Are you using the correct path in the `conditions` prop of the `listener.addTargets` method?
	* Are you explicitly serving the paths in you target group in your service? This is required as [AWS ELB doesn't rewrite paths](https://serverfault.com/questions/876528/how-to-rewrite-paths-in-amazon-application-load-balancer)