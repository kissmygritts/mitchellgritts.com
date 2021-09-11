---
title: "Notes: Caching with AWS CloudFront"
publishedOn: 2021-09-02
updatedOn: 2020-09-02
isPublished: true
category: cloud
tags: [notes, cloudfront, aws]
description: "Notes as I try to figure out how to use CloudFront with an application load balancer as the origin."
---

## Resources

* [Amazon CloudFront Announces Cache and Origin Request Policies](https://aws.amazon.com/blogs/networking-and-content-delivery/amazon-cloudfront-announces-cache-and-origin-request-policies/)
* [AWS CDK - CloudFront Library](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-cloudfront-readme.html)
* [Pricing](https://aws.amazon.com/cloudfront/pricing/)
  * Data transfer to internet: $0.085/GB
  * Data transfer to regions: $0.020/GB
  * HTTPS request: $0.01/10,000 requests
  * All these assume US, Mexico, and Canada

## Creating a CloudFront distribution with the CDK

I've included this in the base stack for now [^1].

```js
// ... other cdk code

// CloudFront cert required in region us-east-1
const cfCert = new acm.DnsValidatedCertificate(this, 'GrittsDevUsEast1', {
	domainName: `apis.${props.rootDomain}`,
	subjectAlternativeNames: [`*.apis.${props.rootDomain}`],
	hostedZone: zone,
	region: 'us-east-1',
	validation: acm.CertificateValidation.fromDns(zone)
})

// CloudFront distribution
const cfDistribution = new cloudfront.Distribution(this, 'ServicesCloudFront', {
	defaultBehavior: {
		origin: new origins.LoadBalancerV2Origin(alb),
		compress: true
	},
	domainNames: [`apis.${props.rootDomain}`, `*.apis.${props.rootDomain}`],
	certificate: cfCert,
	priceClass: cloudfront.PriceClass.PRICE_CLASS_100
})

// Configure DNS to point to the distribution
new route53.ARecord(this, 'Apis_DnsRecord', {
	zone,
	recordName: 'apis',
	target: route53.RecordTarget.fromAlias(
		new route53Targets.CloudFrontTarget(cfDistribution)
	),
	ttl: cdk.Duration.seconds(300),
	comment: 'Subdomain for API services.'
})
new route53.ARecord(this, 'Apis_WildcardDnsRecord', {
	zone,
	recordName: '*.apis',
	target: route53.RecordTarget.fromAlias(
		new route53Targets.CloudFrontTarget(cfDistribution)
	),
	ttl: cdk.Duration.seconds(300),
	comment: 'apis wildcard domain'
})
// ... other cdk code
```

A few things:

* SSL Certificates are required to be located in `us-east-1` region. It is possible to create the same certificate in multiple regions. Use the `acm.DnsValidatedCertificate` construct to define a cross-region certification within a CDK stack.
* To enforce HTTPS between CloudFront and Origin requires each to have an SSL certificate. The certificates to have a matching domain name (or alternative domain name). Just make sure the match. And each have a certificate.
* Make sure [[AWS Route53]] is targeting the distribution.

## Caching benefits

Some dumb off the cuff size and timing examples:

| action    | uncompressed     | compressed    | cached        |
| --------- | ---------------- | ------------- | ------------- |
| load .pbf | 20.15kb in 722ms | 364b in 374ms | 372b in 21ms  |
| hunt feed | 458kb in 324ms   | 38.21 in 458  | 38.21 in 18ms |

## Cache Policies

* [Controlling the cache key](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html)

Use a cache polices to control how CloudFront caches content by changing values used in the cache key. The cache key is a unique identifier used for an object in the cache. A [cache key](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-the-cache-key.html) is used to determine whether a request results in a cache hit or cache miss. 

**A cache hit occurs when the request generates the same cache key as a previous request, and the object for that cache key is in the cache (and valid).** On a cache hit the object is served from the cache. This reduces load on the origin server and reduces latency for the viewer.

The values in the cache key are defined by a cache policy. The URL query string, HTTP headers, and cookies can be modified to change how the cache key is generated. As an example, one way to improve the cache hit ratio is to include only the necessary values in the cache key.

### Default cache key

The default cache key includes the domain name of a CloudFront distribution and the URL path.

```http
GET /content/stories/example-story.html?ref=0123abc&split-pages=false HTTP/1.1
Host: d111111abcdef8.cloudfront.net
User-Agent: Mozilla/5.0 Gecko/20100101 Firefox/68.0
Accept: text/html,*/*
Accept-Language: en-US,en
Cookie: session_id=01234abcd
Referer: https://news.example.com/
```

In the example request above the path (`/content/stories/example-story`) and host (`d111111abcdef8.cloudfront.net`) are included in the cache key. If this request object is not in the cache, a cache miss, CloudFront will send the request to the origin. The origin responds to the request and CloudFront returns the response to the viewer and cache the response at an edge location (with the cache key). I kind of imagine the cache as a key value store, with a similar structure as a WeakMap in javascript.

When another request is made that has a cache key already in the cache CloudFront responds with the cached object. The request is not forwarded to the origin. Therefore any additional routing by the load balancer, processing by the ECS or the database, NAT gateway processing will not occur. The additional CloudFront costs may compensate for the other costs not accumulating on a cache hit. 

```http
GET /content/stories/example-story.html?ref=xyz987&split-pages=true HTTP/1.1
Host: d111111abcdef8.cloudfront.net
User-Agent: Mozilla/5.0 AppleWebKit/537.36 Chrome/83.0.4103.116
Accept: text/html,*/*
Accept-Language: en-US,en
Cookie: session_id=wxyz9876
Referer: https://rss.news.example.net/
```

When CloudFront receives this request (assuming the default cache key) it'll result in a cache hit. The cache key is the same as the first request even though the query string, User-Agent, Referer, and session ID are different.

### Change the cache key with a custom cache policy

Change the cache policy to improve how CloudFront caches content. For example, the querystring might change, if it isn't included in the cache policy different querystrings will result in a cache hit and return the incorrect object.

Values to change/include when creating a policy:

* Name: The name of the policy
* Description: (optional) to describe the policy
* Minimum TTL: the minimum amount of time, in seconds, that you want objects to stay in the cache.
* Maximum TTL: the maximum amount of time, in seconds, that you want objects to stay in the cache.
* Default TTL: the default time that an object stays in the cache.
* Headers: the HTTP headers in the request to include in the cache key. Use the following settings:
	* None: The HTTP headers in the request are not included in the cache key
	* Include the following headers: specify which headers names in the request to include in the cache key (and automatically forwarded to the origin)
* Cookies: Not applicable to me (yet).
* [Query string](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/QueryStringParameters.html):
	* None: query strings are note included in the cache key and not included in origin requests
	* All: All query string are included in the cache key and origin requests.
	* Include specified query strings: the names of query string parameters to include in the cache key and origin requests.
	* Include all query strings except: the inverse of above. 
* Compression support: cache compressed objects, either GZIP or Brotli (or both). **Viewers indicate support for these formats in the `Accept-Encoding` header.**

[With the CDK](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-cloudfront.CachePolicy.html):

```js
const apiCachePolicy = new cloudfront.CachePolicy(
	this,
	'ApiCachePolicy',
	{
		enableAcceptEncodingGzip: true,
		headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Host'),
		queryStringBehavior: cloudfront.CacheQueryStringBehavior.all()
	}
)

new cloudfront.Distribution(this, 'CfnDistribution', {
	defaultBehavior: {
		origin: origin,
		cachePolicy: apiCachePolicy
	}
})
```

### Controlling the cache from the origin

Use the `Cache-Control` and `Expires` HTTP headers from the origin (the API server) to control the cache behavior. [See this resource](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html).

* `Cache-Control: max-age=3600` tells CloudFront to keep the object in the cache for 3600 seconds
* `Cache-Control: no-cache` CloudFront will forward to the origin. *Note: if the origin is unreachable there behavior might change.*


## Caching based on headers

The order of headers doesn't matter for the cache key as long as the values are the same. CloudFront will see `A: 1, B: 2` the same as `B: 2, A: 1`. However, `a: 1, B: 2` will create another cache entry. Case matters.

## Caching based on query strings

* [Caching content based on query string parameters](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/QueryStringParameters.html)

### Optimizing query string caching

Only cache query string parameters that the origin returns different versions of an object. This makes sense and I can't think of a reason why the APIs I've written for NDOW would have a query parameter that doesn't change the response [^2]. 

The example provided in CloudFront's docs is jackets in different colors and sizes. Pictures are different for the colors, but not the sizes. So only cache for color otherwise there will be duplicate photos in the cache.

Order matters. Always list parameters in the same order. Probably best to go alphabetical here. This is a bummer.

Case matters. Use the same case for parameters and values. This is true when writing APIs and shouldn't affect me much anyway. I generally always write and expect all lowercase values.

## Questions I still have

Yeah, I still have a lot of questions. The answers are out there. I just need to find them.

### One or many distributions?

Should I have different distributions for each service? Or similar services? I imagine HuntNV and FishNV will be very similar when it comes to caching. Things don't change very often. Heck, some things might go the full year without a change in the origin. However, Raptor Nests changes every time someone submits data. I don't want cached results. 

Maybe [this is the answer I'm looking for](https://stackoverflow.com/a/46615252). Separate distributions for separate apps (similar enough apps). This will add to the complexity of the infrastructure (more things in the cloud). I don't think it will increase costs since CloudFront charges based on usage. 

It will/might simplify the IaC code? Each stack will manage it's own certificate and Route53 records instead of relying on the the base stack to get all of them correct. I really like this idea.

A single distribution requires path-based routing at the load balancer. CloudFront doesn't allow for creating different behaviors based on the host. This means I can unify the routing scheme by using path-based routing across the infrastructure. So, `apis.gritts.dev/huntnv` and `apis.gritts.dev/fishnv` all point to the load balancer with one behavior and caching policy. Then `apis.gritts.dev/raptor-nests` points to the load balancer with a different behavior and caching policy[^3]. This also means fewer subdomains to worry about.

I really don't like this solution. It requires a not-so-pretty change in the way the services are written. AWS Elastic Load Balancers don't rewrite the paths when routing to the service. that means I need to make sure each service serves the proper path at the base of all routes. For example `/huntnv` would need to be the start of every path within the HuntNV API service.

*Update: 2021-09-03:* After playing around with including the CloudFront distribution in the service stacks it seems like a cleaner(?) option. The shared stack base infrastructure doesn't need any *a priori* knowledge of the services when deployed. This means new services can be deployed without needing to modify the shared stack. Thats a win! The tradeoff? More code in each service and more CloudFront distributions. Which isn't a big deal since AWS only charges for traffic through the distribution. Another huge benefit of this model is more flexibility in the service stacks. For example, the Raptor Nest stack isn't using a CloudFront distribution because all the API requests need to go the database for fresh data. Instead, `raptor-nests.apis.gritts.dev` points to the load balancer.

### How do I invalidate the cache on a new deployment?

I don't remember where I found this snippet. Probably StackOverflow:

```shell
aws cloudfront create-invalidation --distribution-id $ID --paths "/*"
``` 

### How do I prevent things from being cached?

I mentioned this above a little bit. Make sure to include `Cache-Control` headers in the origin. There might be other methods?

### Is there a way to force a cache miss from the viewer?

I don't know yet.

### How do I allow POST requests?

Specify the [Allowed HTTP Methods](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesAllowedHTTPMethods) to process and forward to an origin. By default it is on GET, HEAD in the CDK. 

I need to allow POST, PUT, and PATCH methods for the raptor nests API. So, select the GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE methods. **CloudFront will cache GET and HEAD requests. It doesn't cache responses for any other method**. Good to know.

This does, however, raise the question: should I use a different distribution for raptor nests? It is the only route that uses CUD (create, update, delete) methods. So another reason, for security reasons(?), to use multiple distributions.

FYI, in the CDK this is the `allowedMethods` behavior prop. Use the `cloudfront.AllowedMethods.ENUM` enum to specify the methods.

### Is this all overkill?

My initial reason for using CloudFront was to offload compression from my services. I keep reading that compression should be offloaded of the application server (see [Why should I use a reverse proxy if NodeJS is production ready](https://web.archive.org/web/20190821102906/https://medium.com/intrinsic/why-should-i-use-a-reverse-proxy-if-node-js-is-production-ready-5a079408b2ca)). Why? compression is a highly CPU-bound operation. There are tools that do it better and faster than Node. I imagine CloudFront is using an efficient compression tool behind the scenes.

Then, we get caching, which is probably a better reason to use CloudFront anyway. Especially for mostly static content. However, for raptor nests it might not make sense since it is used for data entry and each GET request needs to go to the database to get fresh data.

Yet another reason it might be overkill for raptor nests is that the audience is internal users only (for now). Speed isn't a huge concern, accurate data is. 

Maybe this is another argument for separate CloudFront distributions for different apps. Who says it needs to be all or nothing?

Side question: does this mean I should manage Route53 domains, certificates individually, in each service stack? Probably.

### How do I forward the Authorization header but not cache it?

A biologist logs into raptor nests and is returned a token. Every subsequent request includes an AUTHORIZATION header with the token. However, cache hits shouldn't be specific to that token. Do I use an Origin policy? The answer is yes.

[^1]: I can't decide the best way to do this right now. Multiple distributions, one for each service, will give us more flexibility. This increases complexity 😕.

[^3]: CloudFront allows multiple behaviors in a single distribution, all pointing to different (or the same) origin. The cache strategies are tied to these behaviors. 

[^2]: I lied. I can think of a way this might work. Suppose an API key (or username) is passed in the query string. This will not change the response from the server. So don't use this in the cache key. Perhaps use the **Include all query strings except** to exclude this parameter.

## Troubleshooting

A few errors that I've had along the way.

### CORS, ofcourse

This ends up biting me in the rear more often than not. When connecting to the API from a front-end I was receiving CORS error failed error on the `HTTP OPTIONS` request. Initially this was because I didn't include `OPTIONS` in the allowed methods. Set this prop like so:

```js
const dist = new cloudfront.Distribution(this, 'cloudfront', {
	defaultBehavior: {
		allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS
		// ... other behavior props
	},
	// ... other distribution props
})
```

Another CORS related error had to do with the headers that were, or weren't being forwarded to the origin (from CloudFront to the load balancer). I think there are two ways to solve this. (You probably only need one of these).

1. Cache control policy: changes to this policy will change how CloudFront caches objects. Each item added to this list will be included in the cache key.
2. Orgin request policy: this policy will change what is forwarded from the viewer to origin, i.e. client -> CloudFront -> load balancer. Use the managed All Viewer policy which will forwards all viewer headers to the origin. If this resolves the CORS errors use this method. It will likely increase the cache hit ratio.

```js
const dist = new cloudfront.Distribution(this, 'cloudfront', {
	defaultBehavior: {
		cachePolicy: new cloudfront.CachePolicy(this, 'cachePolicy', {
			headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Host', 'Access-Control-Request-Headers', 'Access-Control-Request-Method'),
			// ... other cache policy props
		}),
		originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER
		// ... other behavior props
	},
	// ... other distribution props
})
```

