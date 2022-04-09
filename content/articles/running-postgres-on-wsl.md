---
title: "Running PostgreSQL and PostGIS on WSL"
publishedOn: 2022-04-09
updatedOn: 2022-04-09
isPublished: true
category: postgres
tags: [postgres, postgis, wsl, sql]
description: "Running Postgres on Windows Subsystem for Linux using Ubuntu."
---

I generally develop on my Mac. But, working for a state agency means that all our work issued computers are Dells. I find it nearly impossible to develop effeciently on a Windows machine. Sometimes I can't avoid it and I need to develop on the work computer. Or, more likely, I need to get my coworkers setup to run a process I've developed on my Mac on their Windows computers. 

This post assumes you've already installed WSL, and Ubuntu. [Use this documentation if you haven't](https://docs.microsoft.com/en-us/windows/wsl/install).

## Install Postgres

From the [PostgreSQL installation instructions](https://www.postgresql.org/download/linux/ubuntu/):

1. Create file repository configuration.
2. Import repository signing key.
3. Update package list.
4. Install latest version of postgres

```shell
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get -y install postgresql postgresql-client
```

5. Create a user and password for the default postgres user: `sudo passwd postgres`. Try and make this memorable, or use a password manager.
6. Close and reopen the terminal.
7. Start postgres: `sudo service postgresql start`
8. Connect to the database: `sudo -u postgres psql`

## Install PostGIS

Are you doing spatial stuff? Then you prorably want PostGIS too.

1. [Add UbuntuGIS PPA](https://wiki.ubuntu.com/UbuntuGIS).
2. Update `apt`.
3. Install PostGIS. Probably best to look at the list of package in the PPA to get the correct versions installed. 

```shell
sudo add-apt-repository ppa:ubuntugis/ppa
sudo apt-get update
sudoe apt-get install postgresql-14-postgis-3 postgresql-14-postgis-3-scripts
```

4. Connect and check the available postgres extensions:

```shell
sudo -u postgres psql
```

```sql
select * from pg_available_extensions where name like 'postgis%';
```

## Create a New Postgres User

I like to add a user to postgres that matches my Ubuntu user. I think this is what common Mac installations like homebrew or the PostgresApp do. It seems silly, but it makes connecting a few less characters!

```sql
create role username 
with login superuser createdb createrole replication bypassrls password 'password';

\q  -- quite postgres

-- login to default database, shell command
psql postgres
```

No you don't need to use `sudo -u postgres psql` everytime.