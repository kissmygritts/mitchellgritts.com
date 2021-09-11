---
title: "Notes: Minimize AWS costs with VPC endpoints"
publishedOn: 2021-09-07
updatedOn: 2020-09-07
isPublished: true
category: aws
tags: [network, infrastructure, aws]
description: "How to minimize cloud costs by using VPC endpoints instead of NAT gateways"
---

## NAT Gateway

What is a [NAT gateway?](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)

* NAT = network address translation
* allows instances in a private subnet to connect with services outside of the VPC. 
* The inverse is not true. External services cannot connect with those in a private VPC via the NAT gateway
* When the NAT gateway is deployed to a public subnet instances in the private subnet can connect to the internet via the NAT gateway.
* An elastic IP must be associated with the NAT gateway
* Pricing:
	* $0.045 per hour
	* $0.045 per GB of data processed

Right now my understanding of a NAT Gateway is that the only traffic they will process is the traffic to the internet from the instances in a private subnet. Does this include regular outbound traffic from my services, i.e. FishNV? 

Or does it only include the traffic from a private instance to ECR to pull the container, for example? If this is the case the only time it is used is the following instances:

* AWS ECR: to pull images from ECR when container are started.
* AWS S3: to pull the container images/layers when containers are started.
* AWS Secrets Manager: to pull env variables for the containers.
* AWS RDS: when making a request to the database. Since our database is in a separate VPC this traffic must go through the NAT gateway. I think.

### What is the problem with NAT Gateways

<blockquote class="twitter-tweet" data-theme="dark"><p lang="en" dir="ltr">The <a href="https://twitter.com/awscloud?ref_src=twsrc%5Etfw">@awscloud</a> Managed NAT Gateway fucks all creatures great and small. A thread.</p>&mdash; Corey Quinn (@QuinnyPig) <a href="https://twitter.com/QuinnyPig/status/1433949394915639300?ref_src=twsrc%5Etfw">September 4, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

They cost a ton. By default NAT gateways are created in each availability zone when using the CDK. That adds up about $32 a month per NAT gateway just to run it. Multiply that by the number of AZs you have. Boom, giant AWS bill.

## VPC endpoints as a solution

I think I've found a way to minimize or completely remove the NAT gateway from our infrastructure with [**VPC endpoints**](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html). With a VPC endpoint I can create private connections between the VPC and AWS services via AWS PrivateLink. Traffic between the VPC and other services does not leave the AWS network. A VPC endpoint does not require an internet gateway, virtual private gateway, NAT gateway, VPN connection, or AWS Direct Connect connection.

### Considerations for VPC endpoints with ECR with Fargate

We'll need the following endpoints to pull containers from ECR:

* AWS S3
* AWS ECR

Let's try and get these running with a simple API service ([see this repo for a complete code example](https://github.com/kissmygritts/aws-cdk-examples/blob/main/ecs-vpc-endpoints/lib/ecs-vpc-endpoints-stack.js)).

Below is an example of creating a VPC with the endpoints with the AWS CDK. *Note: this is the bare minimum needed to get this stack working*.

```js
// ... other cdk code

/**
 * No longer the default VPC configuration.
 * 1. Specify 0 NAT gateways so that none are created by default
 * 2. Attach gateway VPC endpoint to S3 so that the containers 
 *    can pull image layers
 */
const vpc = new ec2.Vpc(this, 'VPC', {
	maxAzs: 2,
	natGateways: 0,
	gatewayEndpoints: {
		S3: { service: ec2.GatewayVpcEndpointAwsService.S3 }
	}
})

/**
 * Add ECR VPC endpoints two required:
 * 1. com.amazonaws.region.ecr.dkr: ECR_DOCKER 
 * 2. com.amazonaws.region.ecr.api: ECR
 */
vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
	service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER
})
vpc.addInterfaceEndpoint('EcrApiEndpoint', {
	service: ec2.InterfaceVpcEndpointAwsService.ECR
})

// ... other cdk code
```

The `ec2.InterfaceVpcEndpointAwsService` class has several static props to easily define the necessary AWS service endpoints to create ([docs](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ec2.InterfaceVpcEndpointAwsService.html)). It isn't always clear what each is doing, however the actual [source code](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-ec2/lib/vpc-endpoint.ts) might help. For the specific example above I needed to know how to create the `ecr.api` endpoint.

A few AWS services that might be useful with VPC endpoints capabilities:

```js
ec2.InterfaceVpcEndpointAwsService.EC2
ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH
ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS
ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_EVENTS
ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER
ec2.InterfaceVpcEndpointAwsService.LAMBDA
```

There are a few considerations when creating VPC endpoints with ECS, see [this guide on AWS for more details](https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html).

## Troubleshooting

If the `ec2.InterfaceVpcEndpointAwsService.ECR` is omitted the CDK output will stall and not deploy. Hit `CTRL + C`, the `cdk destroy` to tear down the deployment and make the required changes. This is probably true if ECS needs to communicate to any service while created. It'll just hang and not throw an error.

I still can't connect to my database since it is in a different region. that requires a NAT gateway.