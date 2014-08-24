# spinup

`spinup` is a dead simple runner for long-running processes, designed for use during development. Simply create a `spin.up` file containing one shell command per line and launch them all by running `spinup`.

Let's take a look at a simple `spin.up` file:

    # webserver
    python -m SimpleHTTPServer 9000

    # compile javascript
    watchify -o bundle.js main.js

    # just to demonstrate that arguments are parsed correctly
    # (courtesy of substack/shell-quote)
    echo "let's test" "the argument" parser

And when we run `spinup`:

![spinup screenshot](https://raw.githubusercontent.com/jaz303/spinup/master/screenshot.png)

`spinup` will run until all child processes have exited. Hit `Ctrl-C` to send `SIGINT` to any that are still running.

## Installation

    npm install -g spinup

## Copyright &amp; License

&copy; 2014 Jason Frame [ [@jaz303](http://twitter.com/jaz303) / [jason@onehackoranother.com](mailto:jason@onehackoranother.com) ]

Released under the ISC license.