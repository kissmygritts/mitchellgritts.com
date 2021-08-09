---
title: Docker commands cheat sheet
publishedOn: 2021-08-09
updatedOn: 2021-08-09
isPublished: true
topic: docker
description: A quick guide to common docker commands.
---

Example creating/running a docker image called `api`.

```shell
# build a container
docker build -t api:latest .

# run docker container
docker run -d -p 3000:3000 --name api huntnv-api:latest

# connect shell within container
docker exec -it api /bin/sh

# stop running container
docker container stop api

# remove container
docker container rm api
```

## References

* [Documentation](https://docs.docker.com/)
* [CLI Reference](https://docs.docker.com/engine/reference/commandline/cli/)