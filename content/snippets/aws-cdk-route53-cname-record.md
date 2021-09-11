---
title: Create a CNAME record for a database
publishedOn: 2021-09-08
updatedOn: 2021-09-08
isPublished: true
topic: aws cdk
description: Create and add a CNAME record for a database
---

```js
// other cdk code
const db = new rds.DatabaseInstance() // create a database instance
const zone = route53.HostedZone.fromLookup(this, 'HostedZone', { domainName })

new route53.CnameRecord(this, 'cname', {
  zone,
  recordName: 'database',
  domainName: db.dbInstanceEndpointAddress,
  ttl: cdk.Duration.seconds(300)
})
// other cdk code
```

## Context

I wanted to attach a domain name to a database I created with the `rds` CDK constructs. I had only created alias records to this point with the CDK so I assumed the process was similar. However, AWS can only create alias records for a limited set of AWS resource. RDS isn't one of them. Instead, create a CNAME record and point it to the DNS name of the database. 

This `domainName` prop expects a DNS name from an AWS service. Most CDK constructs return a class with method to return this DNS name. In this case that is `db.dbInstanceEndpointAddress`.