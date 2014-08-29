var spawn       = require('child_process').spawn;
var parse       = require('shell-quote').parse;
var colorize    = require('colorize-stream');
var list        = require('list-cycler');
var through     = require('through');

module.exports = spinup;
function spinup(commands, opts) {

    opts = opts || {};

    var stdout      = opts.stdout;
    var stderr      = opts.stderr;
    var env         = opts.env || {};
    var useColor    = ('color' in opts) ? (!!opts.color) : stdout.isTTY;
    var colors      = list(['green', 'yellow', 'blue', 'magenta', 'cyan']);

    procs = commands.map(function(c, taskIx) {

        var args    = parse(c, env);
        var cmd     = args.shift();
        var color   = colors.next();
        
        var child   = spawn(cmd, args, {
            env         : env,
            stdio       : ['ignore', 'pipe', 'pipe'],
            detached    : true
        });
        
        var prefix  = "[" + taskIx + ":" + child.pid + "] ";

        function makePrefixer() {
            return through(function(data) {
                this.queue(prefix + data);
            });
        }

        function makeColorizer() {
            return useColor ? colorize(color) : new stream.PassThrough();
        }

        if (stderr) {
            var introducer = makePrefixer();
            introducer
                .pipe(makeColorizer())
                .pipe(stderr);
            introducer.write(c + "\n");    
        }
        
        if (stdout) {
            child.stdout.setEncoding('utf8');
            child.stdout
                .pipe(makePrefixer())
                .pipe(makeColorizer())
                .pipe(stdout);    
        }

        if (stderr) {
            child.stderr.setEncoding('utf8');
            child.stderr
                .pipe(makePrefixer())
                .pipe(makeColorizer())
                .pipe(stderr);    
        }

        child.on('exit', function() {
            if (stderr) {
                stderr.write(prefix + "terminated\n");    
            }
            child.exited = true;
        });

        child.on('error', function(err) {
            if (stderr) {
                stderr.write(err);    
            }
        });

        return child;

    });

    return {
        kill: function(p) {
            procs.forEach(function(p) {
                if (!p.exited) {
                    p.kill();    
                }   
            });
        }
    }

}