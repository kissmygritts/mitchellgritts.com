---
title: Push Docker Images to AWS ECR
publishedOn: 2021-08-09
updatedOn: 2021-08-09
isPublished: true
topic: docker
description: How to push Docker images to AWS ECR
---

```shell
# authenticate with aws ecr
aws ecr get-login-password --region {REGION} |\
	docker login --username AWS \
	--password-stdin {AWSID}.dkr.ecr.{REGION}.amazonaws.com

# tag image (signature)
docker tag SOURCE_IMAGE[:TAG] TARGET_IMAGE[:TAG]

# tag image (example)
docker tag api:latest {AWSID}.dkr.ecr.{REGION}.amazonaws.com/api:latest

# push to ecr
docker push {AWSID}.dkr.ecr.{REGION}.amazoneaws.com/api:latest
```

* `{REGION}` : replace with your region
* `{AWSID}` : replace AWS account number/id

## References

* [Docker Tag Docs](https://docs.docker.com/engine/reference/commandline/tag/)