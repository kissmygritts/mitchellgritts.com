---
title: "Notes: A Simple AWS ECS Deployment with the AWS CDK"
publishedOn: 2021-08-24
updatedOn: 2020-08-24
isPublished: true
category: aws
tags: [notes, infrastructure, aws]
description: "Notes on how I built a simple AWS ECS infrastructure to run a single application using the AWS CDK IaC toolkit."
---

The cloud is hard. Or, the cloud is hard for me.

Digital Ocean is my preferred deployment method. They really nailed the user interface and developer experience. Especially with their Apps platform. Point to a GitHub repo, choose some settings. BAM, application deployed (and continuously deployed)! *Yes, I know that AWS Amplify exists*.

Unfortunately, we aren't allowed to use Digital Ocean at work. Our cloud provider must be [FedRAMP authorized](https://www.fedramp.gov/). So I must properly figure out how to use AWS. 

We currently have 3 applications running in a few different cloud spaces. Each have their own API and frontend. They all rely on the same database. 

My current goal is to deploy the APIs as services in an AWS ECS cluster (using Fargate, for now). Then each service should be reachable like: `https://*.apis.ndow.dev`. Eventually, there will be some communication between services (especially the spatial services). 

First I need to figure out how to create the infrastructure for these services! So, here is my process. Iterativelly create infrastructure using the AWS CDK with increasing complexity until I better understand what I need (use [this repo](https://github.com/kissmygritts/aws-cdk-examples) to track my progress). Here are the steps to get these services deployed.

1. Create a service to deploy
2. Containerize the service with Docker
3. Write the infrastructure as code (IaC)
4. Deploy services to the code

When this is all deployed the infrastructure should have the following pieces (subject to change).

* AWS ECR to store images of the services
* An ECS cluster with a service running on it 
* A load balancer to route traffic to the service
* A domain pointing to the load balancer with HTTPS enabled
* A CloudMap namespace for service discovery

A few prerequisites that will be helpful moving forward if you plan to follow along:

* Basic NodeJS & JavaScript skills
* Docker & Docker Engine installed and running
* [Install and configure AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)
* AWS CDK installed and configured

## Create a dummy service

The code for `service1` is included below. I am using [Fastify](https://www.fastify.io/) to quickly bootstrap the service.

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

A quick review of the code above.

* **Environment variables**: several environment variables are used to properly get the application working with Docker and ECS.
  * `SERVICE_URL` allows us to specify any other services this service will communicate with.
  * `PORT` for flexibility when deploying the service (or testing locally). This will default to 7071.
  * `HOST` by default I'm serving on `0.0.0.0`. [See here](https://www.fastify.io/docs/latest/Recommendations/#kubernetes).
  * `PATH_PREFIX` is important for path based routing with AWS Elastic Load Balancer[^1].

[^1]: This service is deployed behind an Elastic Load Balancer. ELBs do not rewrite paths. So a request to the load balancer that looks like `https://apis.example.com/service1` will be sent to the Docker container as is. Which means our service will need to expose the path `/service1` as a prefix to every route in the API. Hence the `PATH_PREFIX` env argument.

There are two routes in `service1`:

* `/` displays a simple message.
* `/fetch` will make a request to another service and display the response.

## Docker

A simple Docker file for our app.

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

I've exposed the same environment variable here as in the service. And explicitly set the `NODE_ENV` to production.

Build and test the containers locally:

```shell
docker build -t service1:latest .

docker run -d -p 7071:7071 --name serivce1 service1:latest
```

I did have a few show stopping issues while trying to Dockerize the services (*If you are building containers on Windows, Linux, or an older Mac (non M1) this doesn't apply to you*):

1. I'm developing on an M1 MacBook Pro, an ARM 64 architecture. The containers on AWS ECS run on Linux AMD 64 architecture. I didn't realize this until after a few days of hair pulling. The solution, build multi-platform containers and push the AMD 64 containers to AWS ECR. 
	1. https://docs.docker.com/buildx/working-with-buildx/#build-multi-platform-images
	2. https://medium.com/nttlabs/buildx-multiarch-2c6c2df00ca2
2. Once I figured out the multi-platform builds, my builds would still crash on the `RUN npm ci --only=production` line. It took me the better part of a day to figure out that [there is a bug in Node 16](https://github.com/docker/for-mac/issues/5831) that causes the build to crash. So I switched to Node 14 (the LTS release).

### Push images to AWS ECR

There are several steps to get your Docker image pushed to ECR. This part is slightly annoying and verbose. It is what it is.

1. [Install and configure AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)
2. Create an AWS ECR repository
3. Tag your local docker image with the ECR repository location
4. Sign in and push your tagged image to AWS ECR

Create an ECR repository with the CLI (replace REGION, and USERID with your AWS details):

```shell
# if you have multiple AWS profiles this might help:
export AWS_PROFILE=your profile here

# authenticate to ECR
aws ecr get-login-password --region REGION |\
	docker login --username AWS \
	--password-stdin USERID.dkr.ecr.REGION.amazonaws.com

# create
aws ecr create-repository \
	--repository-name service1 \
	--image-scanning-configuration scanOnPush=true \
	--region REGION
```

Then tag your local image with AWS ECR repo. You can find the commands to do this in the AWS console for the ECR repo created in the ste above.

```shell
docker tag service1:latest ACCOUNTID.dkr.ecr.REGION.amazonaws.com/service1:latest
```

Finally, push the images to ECR:

```shell
docker push ACCOUNTID.dkr.ecr.REGION.amazonaws.com/service1:latest
```

## A too Brief Introduction to the AWS CDK

We'll need to build several resources in AWS in order to get our services running.

* A VPC (virtual private cloud) to isolate our application within it's own network.
* A load balancer to route traffic to the appropriate services (our running containers).
* An AWS ECS cluster to run our services. Within the cluster we will need to create:
	* Task definitions that define our services
	* And service to run the task definitions

We'll use the AWS CDK [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html) to specify our infrastructure as code. I'll be using the javascript version of the CDK.

A few commands to be aware of as we continue building the infrastructure: 

* If this is your first time using the CDK you'll need to run `cdk bootstrap`
* `cdk init --language javascript`: initialize a new javascript CDK application
* `cdk synth`: generate the CloudFormation template for you infrastructure. This template eventually ends up in AWS CloudFormation as a stack that then creates all the resources specified in the template.
* `cdk diff`: inspect the differences between a currently deployed stack and any changes made locally. I do this before deploying because there are some useful information printed to the terminal.
* `cdk deploy`: deploy the current CDK application to AWS CloudFormation. CloudFormation will then use the template to create the necessary AWS resources.
* `cdk destroy`: destroy all the resource created by CloudFormation.

Now, let's create the infrastructure. The code is in [this repo](https://github.com/kissmygritts/aws-cdk-examples/tree/main/ecs-fargate-single-service).

```js
const ec2 = require('@aws-cdk/aws-ec2')
const ecs = require('@aws-cdk/aws-ecs')
const elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2')
const ecr = require('@aws-cdk/aws-ecr')
const cdk = require('@aws-cdk/core')

class EcsFargateSingleServiceStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

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

    // get our image
		const repo = ecr.Repository.fromRepositoryArn(
			this,
			'Servic1Repo',
			`arn:aws:ecr:us-west-2:${props.env.account}:repository/service1`
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
			containerPort: 7071,
			protocol: ecs.Protocol.TCP
		})
		
		// create service
		const service = new ecs.FargateService(
			this,
			'service',
			{
				cluster: cluster,
				taskDefinition: taskDef,
				serviceName: 'service1'
			}
		)
		
		// network the service with the load balancer
		const listener = alb.addListener('listener', {
				open: true,
				port: 80
			}
		)

		// add target group to container
		listener.addTargets('service1', {
			targetGroupName: 'Service1Target',
			port: 80,
			targets: [service]
		})
  }
}

module.exports = { EcsFargateSingleServiceStack }
```

Let's dig in and see what this code is going to create in AWS

1. A VPC with 2 availability zones and all associated networking by default. This includes, public and private subnets, internet gateway, NAT gateway[^2], routing tables, etc.
2. An ECS cluster 
3. An internet facing (public) load balancer
4. Fetching the image pushed to AWS ECR 
5. Create a task definition
6. Attach a container to the task definition
7. Configure port mappings for the container
8. Create the ECS service to run the container
9. Create a listener for the load balancer
10. Route traffic from the listener to the service

[^2]: NAT Gateways are a managed service from AWS and incurs [additional charges](https://aws.amazon.com/vpc/pricing/) . By default the CDK will create 1 NAT Gateway per Availability Zone. This current setup, 2 NAT gateways, will have a baseline cost of about $67 per month. Then any additional network charges on top.

### Deploy to AWS

Before deploying the stack we can inspect the resources that will be created by the CDK. `cdk diff` will output a bunch of text explaining roles and security group changes, and a list of all the resources that will be created. `cdk deploy` will generate a CloudFormation template, push it to AWS then begin creating the infrastructure on AWS. Remember, the CDK is all CloudFormation under the hood. 

Once the stack is deployed, go to the AWS load balancer console on AWS, find the load balancer DNS and copy, then paste that into your URL bar to see the service response.

Run `cdk destroy` to destroy all the resources created in AWS.

## Summary

There you have it. A simple service deployment on AWS ECS with the CDK. I hope to build on this example in a few other posts. In the meantime, checkout the [AWS CDK Examples repo](https://github.com/kissmygritts/aws-cdk-examples).

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