---
title: 'How I Update R'
publishedOn: 2020-05-31
updatedOn: 2020-05-31
isPublished: true
category: R
tags: [R]
description: 'A quick guide on updating R and RStudio with R. And keep you packages up to date too.'
---

The overall release schedule for R is to release updates every year in the spring, with patches issued as needed. You can plan on updating R at least once a year. Updating R isn't always easy. When updated your packages are lost! These are the steps I follow in to update R on my machine. It might not be the best, but it works for me. 

The following line of code will create a list of all the packages you've installed in R. This is a jumbled bit of code, you can dissect it if you want. 

I generally run this in my documents folder of my computer, that way I know where the saved file goes. You can change where this file is saved by changing the `file` parameter in the `save` function.

```r
pkgs <- installed.packages()[, 1][!(installed.packages()[, 1] %in%
          installed.packages(priority = 'base')[, 1])]
save(pkgs, file = 'installed_packages.RData')
```

After running the above snippet of code I'll exit R Studio and install the [newest version of R](https://cran.r-project.org/). Once R is installed run the following line of code to install all of your packages.

```r
load('installed_packages.RData')
install.packages(pkgs)
```

*Note: the current version of these packages will be installed, this may have unintended consequences. If you experience issues you can specify the version you wish to install, and retry the installation of the package causing issues.*

## R & R Studio Setup

General R and R Studio setup tips if you are attempting to install R for the first time.

### Install R

The current (4.1.0 as of May 18, 2021) installation file for R can be found here: [https://cran.r-project.org/](https://cran.r-project.org/). Select the installation for your system. 

### Install R Studio

The current (1.4.1717 as of August 9, 2021) installation file for R Studio can be found here: [https://www.rstudio.com/products/rstudio/download/#download](https://www.rstudio.com/products/rstudio/download/#download). Select the installation for your system.

### Customizing Your IDE

There are many options for to customize your environment. Go to the `Tools > Global Options` menu option. Here you can change the appearance and behavior of R Studio.

#### Useful Settings

Every time I open R I want a fresh environment to work in. On the General tab of the Global Options menu uncheck the `Restore most recently opened project at startup` and `Restore previously open source documents at startup` under the **R Sessions** section. Uncheck the `Restore .RData into workspace at startup` and choose the Never from the drop down for `Save workspace to .RData on exit`.

I prefer a dark IDE, select the Appearance menu item, and in the `Editor theme` box choose a dark theme (or different theme). You'll see a preview to the right.

### Helpful Packages

If you have a fresh install the following packages are good to install.

- `tidyverse` - installs many packages that make working in R a lot more expressive
- `sf` - for spatial data analysis, newer packaged for spatial data
- `raster` - for raster data
- `viridis` - color palettes for plotting continuous data
- `rcartocolors` - color palettes for mapping, diverging, categorical data
- `sp` - the original spatial packages, quickly becoming obsolete because of the `sf` package. You'll still need some of the functions from `sp.`

Install these with the following command

```r
install.packages(c('tidyverse', 'sf', 'raster',
                   'viridis', 'rcartocolors', 'sp'))
```