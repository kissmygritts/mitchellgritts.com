---
title: "Building Microservices with the AWS CDK"
publishedOn: 2021-08-20
updatedOn: 2020-08-20
isPublished: false
category: cloud
tags: [cloud, infrastructure, aws]
description: "How I built a simple AWS ECS microservices application using the AWS CDK IaC toolkit."
---

## Introduction

The [AWS CDK (Cloud Development Kit)](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) is an infrastructure as code tool that allows us to declare infrastructure in our favorite programming languages (JavaScript in this case). It eventually compiles into CloudFormation templates for deployment. These are my notes for creating a simple microservice infrastructure on AWS.

Here is a quick outline of steps in order to deploy simple microservices on AWS.

1. Create a simple API service
2. Dockerize the service
3. Write and deploy our infrastrucutre as code (IaC)

A few prerequisites that will be helpful throughout this article:

* **Basic NodeJS & JavaScript skills** - our services and infrastructure will use javascript 
* **Docker & Docker Engine installed and running** - we need to create containers of our services so that they will run on AWS ECS
* AWS CDK installed and configured

## The Services

First, we'll create a simple API service, let's call it service1. We don't need to do much here. we only need to test that our service can be deployed and run on the infrastructure we provision. Once this is working it'll be easier to understand how AWS ECS works when deploying multiple services (hopefully another article).

Each service is a variation on the code below. `service1` is copy pasted below verbatim. There are two routes in `service1` and `service2`. The `/` route serves a message and the `/fetch` route makes a request to another service (either one or two) and returns a message from that service. Then `service3` only has the `/` route (this service was used to test that things were working properly).

```js
const fastify = require('fastify')({ logger: true })
const { request } = require('undici')

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:7072'
const PORT = process.env.PORT || 7071
const HOST = process.env.HOST || '0.0.0.0'
const PATH_PREFIX = process.env.PATH_PREFIX || ''

const basePath = PATH_PREFIX ? PATH_PREFIX : '/'

fastify.get(basePath, async (req, reply) => {
  return {
    api: 'API 1',
    msg: 'This is API 1.'
  }
})

fastify.get(`${PATH_PREFIX}/fetch`, async (req, reply) => {
  const { body } = await request(`${SERVICE_URL}/service2`)
  const data = await body.json()
  return {
    api: 'API 1',
    msg: 'making request to another service.',
    response: data.msg
  }
})

const start = async () => {
  try {
    await fastify.listen({
      port: PORT,
      host: HOST
    })
    fastify.log.info({
      SERVICE_URL,
      HOST,
      PORT
    })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
```

I used Fastify to quickly bootstrap the service, exposed several environmental parameters, wrote simple route handlers, then start the app.

Not much of this code is very important. However, I do want to point out a few things that I often see overlooked some tutorials. 

1. Serve the app on `HOST 0.0.0.0`. [See here](https://www.fastify.io/docs/latest/Recommendations/#kubernetes).
2. Expose `SERVICE_URL` and `PATH_PREFIX` for added flexibility when deploying to containers.
3. The `PATH_PREFIX` is important when it comes to using path based routing with the AWS Elastic Load Balancer. Load Balancers do not rewrite paths when traffic is routed to the services. If you attempt to route traffic for `service1` to `example.com/service1` the route `/service1` needs to be exposed by the service.

## Docker 

This is also a pretty simple Dockerfile. Again, this is for `service1`

```Dockerfile
FROM node:14.17.4-alpine3.14

ENV NODE_ENV production
ENV PORT 7071
ENV HOST 0.0.0.0
ENV PATH_PREFIX /service1
ENV SERVICE_URL http://localhost:7072

WORKDIR /usr/src/app
COPY --chown=node:node . /usr/src/app

RUN npm ci --only=production
USER node

EXPOSE 7071

CMD ["node", "server.js"]
```

I've exposed the same environment variable here as I did in the services, with default values. 

Then, build the containers, run and test locally (do it for each ):

```shell
# build
docker build --platform linux/amd64 -t service1:latest .

# run
docker run -d -p 3000:3000 --name service1 service1:latest
```

I did have a few show stopping issues while trying to Dockerize the services (*If you are building containers on Windows, Linux, or an older Mac (non M1) this doesn't apply to you*):

1. I'm developing on an M1 MacBook Pro, an ARM 64 architecture. The containers on AWS ECS run on Linux AMD 64 architecture. I didn't realize this until after a few days of hair pulling. The solution, build multi-platform containers and push the AMD 64 containers to AWS ECR. 
	1. https://docs.docker.com/buildx/working-with-buildx/#build-multi-platform-images
	2. https://medium.com/nttlabs/buildx-multiarch-2c6c2df00ca2
2. Once I figured out the multi-platform builds, my builds would still crash on the `RUN npm ci --only=production` line. It took me the better part of a day to figure out that [there is a bug in Node 16](https://github.com/docker/for-mac/issues/5831) that causes the build to crash. So I switched to Node 14 (the LTS release).

### Push to AWS Elastic Container Registry

There are several steps to get your Docker image pushed to ECR. This part is slightly annoying and verbose, but it is what it is.

1. [Install and configure AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)
2. Create an AWS ECR repository
3. Tag your local docker image with the ECR repository location
4. Sign in and push your tagged image to AWS ECR

Second, create an ECR repository with the CLI (or in the AWS Console, but wheres the fun in that?). Replace region with your region if necessary.

```shell
## create 
aws ecr create-repository \
	--repository-name service1 \
	--image-scanning-configuration scanOnPush=true \
	--region us-west-2
```

Third, tag your image with the AWS ECR repo location. The push commands are available to be copy & pasted from the ECR console on AWS. It will look like this:

```shell
docker tag service1:latest ACCOUNTID.dkr.ecr.REGION.amazonaws.com/service1:latest
```

Replace `ACCOUNTID` and `REGION` with the appropriate values.

Finally, login and push the images to ECR. Luckily, each ECR repo provides the login command for you. It looks like this:

```shell
# if you have multiple AWS profiles this'll help:
export AWS_PROFILE=_gritts_

aws ecr get-login-password --region region | \
	docker login --username AWS \
	--password-stdin aws_account_id.dkr.ecr.region.amazonaws.com
	
# then push
docker push ACCOUNTID.dkr.ecr.REGION.amazonaws.com/service1:latest
```

And there we go. Docker images in AWS ECR ready to be pulled where ever we need to use them.

Repeat these steps for all the images you will need. For this example post we need the images for `service1`, `service2`, and `service3` on ECR.

## A too Brief Introduction to the AWS CDK

We'll need to build several resources in AWS in order to get our services running. To list of the major AWS resources we'll need:

* A VPC (virtual private network) to isolate our application within it's own network.
* A load balancer to route traffic to the appropriate services (our running containers).
* An AWS ECS cluster to run our services. Within the cluster we will need to create:
	* Task definitions that define our services
	* And service to run the task definitions

We'll use the AWS CDK [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html) to specify our infrastructure as code. I'll be using the javascript version of the CDK.

A few commands to be aware of as we continue building our infrastructure: 

* If this is your first time using the CDK you'll need to run `cdk bootstrap`
* `cdk init --language javascript`: initialize a new javascript CDK application
* `cdk synth`: generate the CloudFormation template for you infrastructure. This template eventually ends up in AWS CloudFormation as a stack that then creates all the resources specified in the template.
* `cdk diff`: inspect the differences between a currently deployed stack and any changes made locally. I do this before deploying because there are some useful information printed to the terminal.
* `cdk deploy`: deploy the current CDK application to AWS CloudFormation. CloudFormation will then use the template to create the necessary AWS resources.
* `cdk destroy`: destroy all the resource created by CloudFormation.

### AWS CDK Concepts

The CDK provides many building blocks, called [*constructs*](https://docs.aws.amazon.com/cdk/latest/guide/constructs.html), that represent resources in AWS. Each construct is eventually transformed into a CloudFormation template that can be used to create the resources in AWS.

Constructs generally have few require props. Other props are optional and generally set to sensible defaults.

For a more thorough overview of key CDK concepts check the [AWS CDK developer guide](https://docs.aws.amazon.com/cdk/latest/guide/core_concepts.html).

## Building a Quick Example Infrastructure

In this first part let's build and deploy a simple infrastructure and services to AWS. We'll do this to make sure everything is working as intended before moving on to something more complex.

### Base Stack Components

There are a few components that should be created at the beginning so that they can be referenced later: 

* VPC: created with the [Amazon EC2 Construct Library](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ec2-readme.html)
* ECS cluster: created with the [Amazon ECS Construct Library](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecs-readme.html) to create the cluster
* Load Balancer: created with the [Amazon Elastic Load Balancing V2 Construct Librar](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-elasticloadbalancingv2-readme.html)

In order to build these resources let's install the necessary CDK construct libraries:

```shell
npm install -S @aws-cdk/aws-ec2 @aws-cdk/aws-ecs @aws-cdk/aws-ecr @aws-cdk/aws-elasticloadbalancingv2
```

Then define the infrastructure as follows:

```js
const ec2 = require('@aws-cdk/aws-ec2')
const ecs = require('@aws-cdk/aws-ecs')
const elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2')
const ecr = require('@aws-cdk/aws-ecr')
const cdk = require('@aws-cdk/core')

class MicroserviceStack extends cdk.Stack {
	constructor(scope, id, props) {
		super(scope, id, props)
		
		// base infrastucture
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
		
	}
}
```

Let's dig in and see what the these constructs are doing.

#### VPC

The [VPC construct](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ec2.Vpc.html) is used to define an virtual private cloud. All of the props for this construct are optional. A few to be aware of are:

* `cidr`: the CIDR range to use for the VPC
* `maxAzs`: the maximum number of availability zones to use  in the region
* `subnetConfiguration`: configure the subnets to build in each availability zone.

Check [this page](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ec2.VpcProps.html) for more details on each prop for the VPC construct.

By default this construct will create a VPC that spans the whole region. It will automatically create public and private subnets in each availability zone (up to the number specified in the `maxAzs` prop). Networking will be taken care of for the private, with NAT Gateways, and public, with internet gateways, subnets. All these default configurations are built by CDK maintainers and follow best practices.

We created a simple, and nearly default, VPC. We only specified two availability zones (the default is three). Everything else is created automatically!

#### ECS Cluster

The [ECS construct](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.Cluster.html) is used to define the cluster we will run our services. We only specify two props while creating this cluster:

* `vpc`: the VPC where the ECS cluster will run.
* `clusterName`: a human readable name for the cluster.

Check [this page](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.ClusterProps.html) for more details on each prop for the ECS construct.

#### Application Load Balancer

The [Application Load Balancer (ALB) construct](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-elasticloadbalancingv2-readme.html) is used to define an application load balancer. We've specified three props while creating this load balancer:

* `vpc`: the VPC where the load balancer will run.
* `loadBalancerName`: a human readable name for the load balancer.
* `internetFacing`: whether the load balancer has an internet routable address.

Check [this page](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-elasticloadbalancingv2.ApplicationLoadBalancerProps.html) for more detail on each prop for the Application Load Balancer construct.

This construct will create create security groups by default. When listeners and target groups are created security groups will be created or modified as needed (we'll do this shortly). Pretty cool!

These three components (the VPC, ECS cluster, and ALB) are the foundation of our infrastructure. The VPC is referenced twice within these base components. When we add a few of the other components we'll need to reference these components.

### Deploying Services 

Now we need run our dockerized application on the ECS cluster. The process looks like this:

1. Grab our Docker image from AWS ECR to be used in the task definition
2. Create a task definition and add the container to the task definition
3. Configure the service that will run the task definition
4. Connect the service to the load balancer so that traffic can reach our application

```js
class MicroserviceStack extends cdk.Stack {
	constructor(scope, id, props) {
		super(scope, id, props)
		
		// ... base infrastucture from above
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
		
		// get our image, replace REGION and ACCOUNTID with yours
		const repo = ecr.Repository.fromRepositoryArn(
			this,
			'Servic1Repo',
			'arn:aws:ecr:REGION:ACCOUNTID:repository/service3'
		)
		const image = ecs.ContainerImage.fromEcrRepository(repo, 'latest')
		
		// task definition
		const taskDef = new ecs.FargateTaskDefinition(
			this,
			'taskDef',
			{
				compatibility: ecs.Compatibility.EC2_AND_FARGATE,
				cpu: '256',
				memoryMiB: '512',
				networkMode: ecs.NetworkMode.AWS_VPC
			}
		)
		const container = taskDef.addContainer('Container', {
			image: image,
			memoryLimitMiB: 512
		})
		container.addPortMappings({
			containerPort: 7073,
			protocol: ecs.Protocol.TCP
		})
		
		// create service
		const service = new ecs.FargateService(
			this,
			'service',
			{
				cluster: cluster,
				taskDefinition: taskDef,
				serviceName: 'service3'
			}
		)
		
		// network the service with the load balancer
		const listener = alb.addListener('listener', {
				open: true,
				port: 80
			}
		)

		// add target group to container
		listener.addTargets('service3', {
			targetGroupName: 'Service3Target',
			port: 80,
			targets: [service]
		})
		
	}
}
```

Now run `cdk diff` and a lot of information get printed to your terminal. This is an overview of all the AWS components that will be created by this CDK app. `cdk deploy` will deploy the application. 

Let's dig into these new CDK constructs so that we understand what is happening.

#### Containers and Images

We use `ecr.Repository.fromRepositoryArn()` ([docs](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecr.Repository.html#static-fromwbrrepositorywbrarnscope-id-repositoryarn)) to explicitly reference an repository in ECR. Doing it this way will automatically assign the proper IAM permissions to the `taskExecutionRole` used by our tasks. 

Then reference the latest image with `ecs.ContainerImage.fromEcrRepository()` ([docs](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.ContainerImage.html)) to be run in our service. Many of the tutorials I found leave out this information. Generally they opt to use `ContainerImage.fromRegistry()` that pulls images from Docker Hub. If you prefer that method, go ahead an push your containers to Docker Hub instead (or any other public registry).

*Note: we aren't using the `new` keyword when referencing the ECR repo and image. The two methods we are using, `fromRepositoryArn` and `fromEcrRepository`, are static methods for their respective classes. They aren't used to create new components in AWS. Instead, they are references to existing components. I don't know how correct this assumption is, but it helped me understand how things are working behind the scenes.*

#### Task Definition

Once we've created references to the image we use the [ECS construct library](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecs-readme.html) to create a [Fargate task definition](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.FargateTaskDefinition.html) with the following [props](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.FargateTaskDefinitionProps.html):

* `compatibility`: the allowed launch types for the task.
* `cpu`: the number of CPU units (defaults to 256)
* `memoryMiB`: the amount of memory used (defaults to 512)
* `networkMode`: the Docker networking mode to use. Fargate tasks require the `awsvpc` mode.

I've essentially specified all the defaults our example. I could have left them all blank and we would end up with the same task definition.

We need to add a container to the task definition with `.addContainer()`. There are many [props](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.ContainerDefinitionOptions.html) we can define when adding a container. The only required prop is `image` which is the image used to be used by our service. 

Finally, we need to configure the port mappings to our container with `.addPortMappings()` ([docs](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.ContainerDefinition.html#addwbrportwbrmappingsportmappings). In the props we specify the port we expose on the container and the protocol. Most often the protocol will be `TCP`.

#### Fargate Service 

The [Fargate Service construct](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.FargateService.html) will create a service using the Fargate launch type on our ECS cluster. We'll reference the cluster we created in the base stack, as well as the task definition created in the last section in the [props](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.FargateServiceProps.html). 

For a more detailed explanation of ECS and running Fargate services on ECS refer to the [AWS documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html).

#### Networking the Service

Finally, we can connect the load balancer to the containers on ECS by adding listeners to the load balancer. This is a simple use case. The load balancer will listen on port 80 and route the traffic to our service. 

We have full access to all the capabilities of application load balancers at this stage. We'll get to some more advance use cases in future sections.

### Viewing our Application

Once the application is deployed, navigate to the load balancer page on the AWS console (website) and copy the DNS name. Paste the DNS name into the URL bar and you'll see your application. A simple REST api with a message. 

The CDK took care of all the dirty work for us. The ~80 lines of code we wrote turned into ~780 lines of CloudFormation template code and created ~35 resources on AWS. And the best part is that we can easily destroy and redeploy our changes as needed!

After visiting the URL and seeing that the application is working go ahead and destory the infrastructure with `cdk destroy`.

## Moving to Microservices with the CDK

Now that we've covered the basics let's create a more complicated infrastructure. 

As I learned the ins and outs of the CDK and deploying microservices I hit several stumbling blocks. I've already mentioned difficulties with building multi-platform images, and bugs in Node 16 that caused containers to crash. Deploying multiple containers ended up being a pretty large stumbling block. Hopefully this will help fully explain some of the situations to avoid along the way.

We can use the base stack constructs created above as the foundation for the microservice infrastructure. The main differences will be:

* Running 3 services on ECS
	* The three services are almost identical. We'll reuse service3 from above. Service1 and service2 each have a route that fetches data from the other. 
* Using a domain name with our load balancer
* Serving traffic over HTTPS
* Service discovery so that containers can communicate with each other

There is a lot to cover!

### Stack Components

The VPC, load balancer, and ECS cluster we created above will not change for this example. The component above will be added, and we'll review them like we did for the simpler one service stack. 

The services have some changes compared to what we did in the previous example. We'll go into detail about those changes.

#### Service Discovery

Service discovery will allow the services within our ECS cluster communicate with each other. [AWS Cloud Map](https://docs.aws.amazon.com/cloud-map/latest/dg/what-is-cloud-map.html) is used to create and maintain a map of our services within a namespace with the [Service Discovery construct library](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-servicediscovery-readme.html). We'll use a private DNS namespace that will allow API and DNS queries within the VPC we created. 

```js
const namespace = new serviceDiscovery.PrivateDnsNamespace(
	this,
	'serviceDiscoveryNamespace',
	{
		name: 'services',
		vpc
	}
)
```

Later, when we create our services with `ecs.FargateService` will use the `cloudMapOptions` prop to attach the service to our namespace.

#### Security Groups

Security groups always seem to mess me up! Fortunately the CDK takes care of most the complicated stuff. And even when it doesn't the CDK makes it easy. 

We do need to create one security group with the Security [Group construct](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ec2.SecurityGroup.html). In order for the services to communicate with each other their security groups must [allow traffic between them](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ec2-readme.html#allowing-connections).

```js
// ... other CDK code
const servicesSecurityGroup = new ec2.SecurityGroup(
	this, 
	'servicesSecurityGroup', 
	{
		vpc,
		allowAllOutbound: true
	}
)
// ... other CDK code
```

Now we'll be able to assign all our services to the `servicesSecurityGroup` and allow communication between services within this security group. When we create our services we'll set the `securityGroups` prop to `servicesSecurityGroup` (more on that shortly!).

#### Domain Name, DNS, and Certs

We definitely want to use our own domain for the services we create. You'll need to own/purchase a domain to use for this part of the example. If you don't have a domain, I recommend purchasing one through AWS Route 53. It'll make this part a little easier. If you already purchased a domain you'll need to [make Route 53 your DNS service](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/migrate-dns-domain-inactive.html).

Once you have a domain we need to do a few things: 

* We'll lookup the Hosted Zone for reference using the [Route 53 construct library](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-route53-readme.html).
	* Similar to the ECR repos we are creating a reference to an already existing resource in AWS. We don't need the `new` keyword.
* Create an SSL/TLS certificate for our domain and subdomains with [AWS Certificate Manager construct library](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-certificatemanager-readme.html)
	* Let's use `services.gritts.dev` as the domain to associate with our services.
	* We'll add the `*.services.gritts.dev` subdomain to our certificate too. 
	* We'll use DNS validation to automatically add the necessary DNS records to validate our certificate. Nothing else needed!
* Create a record in our Hosted Zone for the subdomain with Route 53
	* Create an A record for `services`
	* Point the record to our load balancer with [`loadBalancerTarget`](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-route53-targets.LoadBalancerTarget.html)

```js
// ... other CDK code

// I'm using a domain I own: gritts.dev
// be certain to register and use your own domain!
const zone = route53.HostedZone.fromLookup(
	this,
	'HostedZone',
	{ domainName: 'gritts.dev' }
)

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

// ... other CDK code
```

Once the stack is deployed we will be able to navigate to `https://services.gritts.dev`

A few things to note:

* `.dev` top level domains require HTTPS in order to work in the browser. You can `curl` a `.dev` domain but won't be able to see it in your browser.
* The certificate we create will be destroyed when we run `cdk destroy`. This is good as it lets us quickly prototype without needing to worry about creating multiple certificates. 

#### A little more Load Balancing

We still need to set a default action for the base route `/`. We also need to redirect traffic from port 80 to port 443 for HTTPS traffic. So let's dig into the load balancer code one more time.

The code is very similar to the our single service CDK stack. We'll still listen on port 80, but redirect that traffic to port 442 using `ListenerAction.redirect()`.

Then, instead of sending the fixed response on port 80, well send it on port 443 instead. We'll reference our listener on port 443 when networking the services. 

```js
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
```

The CDK will do some behind the scenes work to make sure the load balancer security group accepts traffic on port 443!

#### Fargate Services

This is almost identical to the code for our single service stack. A few of the changes we will make:

* Instead of one service we will have three
* Two of the services will communicate to each other using the Service Discover namespace we created earlier.
	* We need to add a `SERVICE_URL` environment variable service1 and service2
* Allow traffic within security group on the necessary ports (7071, 7072, 7073).
* Create target groups using path based routing
* Change the healthcheck routes for the services.

I'll include the code for service one below. You can check the code [in this Gist for all the services](https://gist.github.com/kissmygritts/c2db94290f7d1f52f9d6f25196bad7b6)

```js
const repoOne = ecr.Repository.fromRepositoryArn(
	this,
	`EcrRepo1`,
	'arn:aws:ecr:REGION:ACCOUNTID:repository/service1'
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
		// use service discover to reference service2
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
			// add service to service discovery
			name: 'service1',
			cloudMapNamespace: namespace,
			dnsRecordType: serviceDiscovery.DnsRecordType.A
		}
	}
)

// allow traffic from security group
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

This is very similar to the code we wrote in our single service infrastructure above. The biggest differences are:

* Added logging to each container with `ecs.LogDriver.awsLogs`
* Added an environment variable to the container.
* Assigned the service to the `servicesSecurityGroup` and allow traffic within the security group on port 7071
* Included the service in the service discovery namespace with the name `service1`. This means we can reference service1 from other services like this: `https://service1.services:7071`.
* Explicitly defined a `healthCheck` route for our target group.

Service2 and service3 are similar to service1. I've excluded to code for these services from the snippet above. [Check the GitHub repo](https://gist.github.com/kissmygritts/c2db94290f7d1f52f9d6f25196bad7b6)

### Deploy!

Now, finally, run `cdk deploy`! You'll see a big long list of all the resource that will be created. Once deployment finishes use [DNS Checker](https://dnschecker.org) to see if your domain name and subdomain have propagated. Once they have check to see if you microservices work!

I'll use `curl` and `jq` to make sure everything works. You should see some output like this if they did work:

```shell
curl https://services.gritts.dev | jq
# output: 
# { "msg": "base route"}

curl https://services.gritts.dev/service1 | jq
# output: 
# {
#   "api": "API 1",
#   "msg": "This is API 1."
# }

curl https://services.gritts.dev/service1/fetch | jq
# {
#   "api": "API 1",
#   "msg": "making request to another service.",
#   "response": "This is API 2."
# }

# ... etc for service2 and service3
```

Very cool! 

### Troubleshooting

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
