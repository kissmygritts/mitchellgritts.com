---
title: Adding certificates to an ApplicationListener
publishedOn: 2021-09-03
updatedOn: 2021-09-03
isPublished: true
topic: aws cdk
description: Avoid cyclic references with ApplicationListenerCertificate
---

```js
// ... shared stack cdk code ...
const alb = new elbv2.ApllicationLoadBalancer(this, 'alb', { vpc })
const listener = alb.addListener('listener', {
  open: true,
  port: 443,
  certificates: [
    // a certificate for apis.gritts.dev
  ]
})

// ... service stack cdk code ...
const zone = // ... fetch your hosted zone

// Add an additional cert to the listener after the listener is created
// first create the new cert
const cert = new acm.Certificate(this, 'HuntNvCert', {
  domainName: 'huntnv.apis.gritts.dev',
  validation: acm.CertificateValidation.fromDns(zone)
})

// first method, caused cyclic reference error
props.listener.addCertificates('AnotherCert', [cert])

// second method, worked
const listenerCert = new elbv2.ApplicationListenerCertificate(this, 'HuntNvListenerCert', {
  listener: props.listener,
  certificates: [cert]
})
```

## Context

I'm experimenting moving all the DNS, listener, and CloudFront resource creation to indivdual service stacks. That way each service stach is self contained. It creates all its own resources. This also means that the shared infrastructure doesn't need to know all the domain names, listener targets, and CloudFront distributions before hand.

*Important note, this is all based upon using multiple stacks to build the infrastructure.*

My first attempt was to use the `listener.addCertificates` ([docs](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-elasticloadbalancingv2.ApplicationListener.html#addwbrcertificatesid-certificates)) method provided by the `ApplicationListener` construct ([docs](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-elasticloadbalancingv2.ApplicationListener.html)). Unfortunately this thows a cyclic reference error. I can't tell you why.

Closer inspection of the documentation shows another method to attach additional certificates to a listener with the `ApplicationListenerCertificate` construct ([docs](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-elasticloadbalancingv2.ApplicationListenerCertificate.html)). This does work and deploys correctly as intended.
