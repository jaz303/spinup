var spawn = require('child_process').spawn;
var parse = require('shell-quote').parse;


module.exports = spinup;
function spinup(commands, opts) {

    opts = opts || {};

    var stdout      = opts.stdout || process.stdout;
    var stderr      = opts.stderr || process.stderr;
    var env         = opts.env || process.env;
    var colorize    = ('color' in opts) ? (!!opts.color) : stdout.isTTY;

    var nextColor = 0;
    function makeColor() {
        // cycles green, yellow, blue, magenta, cyan
        return ((nextColor++) % 5) + 2;
    }

    procs = commands.map(function(c, taskIx) {

        var args    = parse(c);
        var cmd     = args.shift();
        var color   = makeColor();
        
        var child   = spawn(cmd, args, {
            env         : env,
            stdio       : ['ignore', 'pipe', 'pipe'],
            detached    : true
        });
        
        var prefix  = "[" + taskIx + ":" + child.pid + "]";

        function _colorize(text) {
            if (colorize) {
                return "\x1b[3" + color + "m" + text + "\x1b[0m";   
            } else {
                return text;
            }
        }

        stderr.write(_colorize(prefix + " " + c) + "\n");

        child.stdout.setEncoding('utf8');
        child.stdout.on('data', function(str) {
            stdout.write(_colorize(prefix + " " + str));
        });

        child.stderr.setEncoding('utf8');
        child.stderr.on('data', function(str) {
            stderr.write(_colorize(prefix + " " + str));
        });

        child.on('exit', function() {
            stderr.write(prefix + " terminated\n");
            child.exited = true;
        });

        child.on('error', function(err) {
            stderr.write(err);
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