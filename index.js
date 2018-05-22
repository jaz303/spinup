var spawn       = require('child_process').spawn;
var quote       = require('shell-quote').quote;
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
    var prefix      = opts.prefix === false ? '' : (opts.prefix || '[%t:%n8]');
    var groups      = opts.groups || null;

    stdout.setMaxListeners(10000);
    stderr.setMaxListeners(10000);

    procs = commands.filter((c) => {
        return (groups === null) || groups.some(g => c.groups.indexOf(g) >= 0);
    }).map(function(c, taskIx) {

        var args        = parse(c.commandLine, env);
        var commandLine = args.slice(0);
        var cmd         = args.shift();
        var commandName = c.name || cmd;
        var color       = colors.next();
        
        var child = spawn(cmd, args, {
            cwd         : c.workingDirectory,
            env         : env,
            stdio       : ['ignore', 'pipe', 'pipe'],
            detached    : true
        });

        child.killSignal = c.killSignal;

        function _prefix() {
            
            var now = new Date();

            function pad2(v) { return (v < 10 ? '0' : '') + v; }

            var p = prefix.replace(/%([tpYymdHMS]|([cn]\d*))/g, function(m) {
                switch (m[1]) {
                    case 't': return taskIx;
                    case 'p': return child.pid;
                    case 'Y': return now.getFullYear();
                    case 'y': return now.getYear() % 100;
                    case 'm': return pad2(now.getMonth() + 1);
                    case 'd': return pad2(now.getDate());
                    case 'H': return pad2(now.getHours());
                    case 'M': return pad2(now.getMinutes());
                    case 'S': return pad2(now.getSeconds());
                    case 'c':
                    case 'n':
                        var text = (m[1] === 'c') ? cmd : commandName;
                        if (m.length === 2) {
                            return text;
                        } else {
                            var len = parseInt(m.substr(2), 10);
                            var str = text.substr(0, len);
                            while (str.length < len) {
                                str += ' ';
                            }
                            return str;
                        }
                }
            });

            return p.length ? (p + ' ') : p;

        }

        function makePrefixer() {
            return through(function(data) {
                this.queue(data.trim().replace(/^/mg, _prefix()) + "\n");
            });
        }

        function makeColorizer(c) {
            return useColor ? colorize(c) : new stream.PassThrough();
        }

        if (stderr) {
            var introducer = makeColorizer(color)
            introducer.pipe(stderr);
            introducer.write(_prefix() + '$ ' + quote(commandLine) + "\n");
        }
        
        if (stdout) {
            child.stdout.setEncoding('utf8');
            child.stdout
                .pipe(makePrefixer())
                .pipe(makeColorizer(color))
                .pipe(stdout);    
        }

        if (stderr) {
            child.stderr.setEncoding('utf8');
            child.stderr
                .pipe(makePrefixer())
                .pipe(makeColorizer(c.colorizeStderr ? color : 'red'))
                .pipe(stderr);    
        }

        child.on('exit', function() {
            if (stderr) {
                stderr.write(_prefix() + "terminated\n");
            }
            child.exited = true;
        });

        child.on('error', function(err) {
            if (stderr) {
                stderr.write(_prefix() + err.message + "\n");
            }
        });

        return child;

    });

    return {
        kill: function(p) {
            procs.forEach(function(p) {
                if (!p.exited) {
                    process.kill(-p.pid, p.killSignal);    
                }   
            });
        }
    }

}