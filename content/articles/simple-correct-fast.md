---
title: Simple, Correct, Fast
publishedOn: 2019-10-22
updatedOn: 2019-10-22
isPublished: true
category: programming
tags: [R, spatial]
description: Adventures in clever, overly complex code and how to simplify leads to correctness and speed.
---

>The single most important quality in a piece of software is simplicity. It’s more important than doing the task you set out to achieve. It’s more important than performance. The reason is straightforward: if your solution is not simple, it will not be correct or fast.
> [Drew DeVault](https://drewdevault.com/2018/07/09/Simple-correct-fast.html)

I've fallen victim to my own cleverness more times than I would like to admit. After reading Drew's post I've realized how often this happens to me. Let me show you an example.

## Setup

The code below will get us setup to run the examples. I've also included some `sf` code to confirm the area of the polygon is indeed 1.

```r
# calculate the area of a polygon, 
# in this case a square with an area of 1
x <- c(0, 1, 1, 0, 0)
y <- c(0, 0, 1, 1, 0)

# use sf to confirm area is indeed 1
sf::st_area(sf::st_polygon(list(cbind(x, y))))

# create vectors to traverse the sides of the polygon in
# r using the shoelace formula
x0 <- x[1:4]
x1 <- x[2:5]
y0 <- y[1:4]
y1 <- y[2:5]

```

The last few lines will be used to traverse the vertices of the polygon using the [shoelace formula](https://en.wikipedia.org/wiki/Shoelace_formula). 

## The first attempt

My first attempt at implementing the shoelace formula went as follows.

```r
(Reduce(`+`, (x0 * y1)) - Reduce(`+`, (x1 * y0))) / 2
#> 1
```

The code does return the correct answer. I did account for vectorized operations in R. In other languages we would need to loop over the vector (`x0, y1, ect...`) in order to multiply them together. But is it simple? No it isn't.

I probably ended up at this implementation because I had just finished writing a lot of JavaScript. I tend to use `reduce` often in JavaScript, and in R `Reduce` is similar. I ended up with code that was half JavaScript inspired and half R inspired. 

### Encapsulation

Before moving on let's write a function to encapsulate our area function. 

```r
get_area <- function (polygon_matrix) {
  n <- nrow(polygon_matrix)
  
  x0 <- polygon_matrix[1:n - 1, 1]
  x1 <- polygon_matrix[2:n, 1]
  y0 <- polygon_matrix[1:n - 1, 2]
  y1 <- polygon_matrix[2:n, 2]

  (Reduce(`+`, (x0 * y1)) - Reduce(`+`, (x1 * y0))) / 2
}
```

Moving forward changes will be made to this function. And to be a little more rigorous, let's add some testing using the `assertthat` library. This will compare the results of `sf::st_area` to our `get_area` function. If `assertthat::are_equal` returns `FALSE`, our function isn't working properly.

```r
polygon_matrix <- cbind(x, y)

# test
assertthat::are_equal(
  get_area(polygon_matrix),
  sf::st_area(sf::st_polygon(list(polygon_matrix)))
)
```

## Attempt 2

> Debugging is twice as hard as writing the code in the first place. Therefore, if you write the code as cleverly as possible, you are, by definition, not smart enough to debug it. 
> Brian Kernighan

I was trying to be clever. I had found a perfect use case for the `Reduce` function. And not just once, but twice, in the same line of code! In fact, I was pleased with the cleverness of my code.

The hubris was short lived. In my cleverness I had overlooked the existance of the function `sum`. I couldn't believe how stupid I had been (my inner dialogue can be harsh). 

So I rewrote the code using `sum`.

```r
get_area <- function (polygon_matrix) {
  n <- nrow(polygon_matrix)
  
  x0 <- polygon_matrix[1:n - 1, 1]
  x1 <- polygon_matrix[2:n, 1]
  y0 <- polygon_matrix[1:n - 1, 2]
  y1 <- polygon_matrix[2:n, 2]

  (sum(x0 * y1) - sum(x1 * y0)) / 2
}

assertthat::are_equal(
  get_area(polygon_matrix),
  sf::st_area(sf::st_polygon(list(polygon_matrix)))
)
#> [1] TRUE
```

Indeed, it returns the correct answer. The main logic in the function is still one line of code. It is simple. But it can be simplified even more!

## Attempt 3

Alas, it can be even simpler. And potentially faster. `sum` is used twice. `sum` is vectorized and I've made use of it in the function above. But I forgot about the order of operations, and the actual [mathematical notation](https://en.wikipedia.org/wiki/Shoelace_formula#Statement) of the shoelace formula.

Back to the drawing board.

```r
get_area <- function (polygon_matrix) {
  n <- nrow(polygon_matrix)
  
  x0 <- polygon_matrix[1:n - 1, 1]
  x1 <- polygon_matrix[2:n, 1]
  y0 <- polygon_matrix[1:n - 1, 2]
  y1 <- polygon_matrix[2:n, 2]

  sum(x0 * y1 - x1 * y0) / 2
}

assertthat::are_equal(
  get_area(polygon_matrix),
  sf::st_area(sf::st_polygon(list(polygon_matrix)))
)
```

Finally, correct and simple. And since there is only a single `sum` function call it should be faster. I've not performed any benchmarking to confirm this. 

## Summary

Just to be certain, let's try this code on a more complex polygon to make sure it works. The area of the polygon is 30. Let's see if the `get_area` function works properly.

```r
x <- c(3, 5, 9, 12, 5, 3)
y <- c(4, 6, 5, 8, 11, 4)

polygon_matrix <- cbind(x, y)

assertthat::are_equal(
  get_area(polygon_matrix),
  sf::st_area(sf::st_polygon(list(polygon_matrix)))
)
#> [1] TRUE
``` 

The first iteration of the `get_area` function was complex. Two needless calls to a function that isn't very common (`Reduce`), using a syntax that isn't super familiar (using an [operator](https://www.datamentor.io/r-programming/infix-operator/) within the back ticks). 

The second iteration doesn't use `Reduce`, but two redundant instances of the `sum` function. Simpler, but not the simplest. The final implementation is indeed the simplest, and it's proven to be correct (and I think faster). 

I think it is easy to get caught up in writing code that just solves the problem, or is fast, and forgetting to take the time to ask if it is simple. So slow down a little, and double check your work (I always hated hearing that phrase from my teachers). Please read the [article](https://drewdevault.com/2018/07/09/Simple-correct-fast.html) I linked to above. Drew makes a great point, "If you solution is not simple, it will not be correct or fast".