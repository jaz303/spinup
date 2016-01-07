var spinup = require('./index');
var fs = require('fs');
var path = require('path');
var dotenv = require('dotenv');
var parse = require('shell-quote').parse;

var spinfile = process.argv[2] || 'spin.up';
var spindir = path.resolve(path.dirname(spinfile));

dotenv._getKeysAndValuesFromEnvFilePath(spindir + '/.env');
dotenv._setEnvs();

var commands = [],
    instance = null,
    exiting = false,
    prefix = null,
    env = process.env;

env.SPINDIR = spindir;

try {

    var thisCommand;
    function newCommand() {
        thisCommand = {
            colorizeStderr: false,
            commandLine: null,
            killSignal: 'SIGTERM',
            name: null
        };
    }
    newCommand();

    var lines = fs
        .readFileSync(spinfile, {encoding: 'utf8'})
        .split(/(?:\r\n?|\n)/)
        .map(function(l) { return l.replace(/#.*?$/, ''); })
        .map(function(l) { return l.trim(); })
        .filter(function(l) { return l.length > 0; })
        .forEach(function(l) {
            if (l[0] === '!') {
                applyDirective(l);
            } else if (l[0] === '@') {
                applyCommandOption(l);
            } else {
                thisCommand.commandLine = l;
                commands.push(thisCommand);
                newCommand();
            }
        });

    function applyDirective(directive) {
        if (directive.match(/^\!ports\s+(\$(\w+)\:)?(\d+)((\s+\$\w+)*)\s*$/)) {
            var base = RegExp.$3;
            if (RegExp.$2 && (RegExp.$2 in env)) {
                base = env[RegExp.$2];
            }
            base = parseInt(base, 10);
            if (!isFinite(base)) {
                throw new Error("invalid base port; must be numeric");
            }
            RegExp.$4.trim().split(/\s+/).forEach(function(v) {
                env[v.substring(1)] = base++;
            });
        } else if (directive.match(/^\!noprefix$/)) {
            prefix = false;
        } else if (directive.match(/^\!prefix\s+(.*?)$/)) {
            prefix = RegExp.$1;
        } else if (directive.match(/^\!set\s+(\w+)\s+(.*?)$/)) {
            var key = RegExp.$1, parsed = parse(RegExp.$2, env);
            if (parsed.length !== 1) {
                throw new Error("value for !set directive must evaluate to a single value (try quoting with \"\")");
            }
            env[key] = parsed[0];
        } else {
            throw new Error("unknown directive: " + directive);
        }
    }

    function applyCommandOption(option) {
        if (option.match(/^@cd\s+([^$]+)$/)) {
            thisCommand.workingDirectory = RegExp.$1;
        } else if (option.match(/^@kill\s+([^$]+)$/)) {
            thisCommand.killSignal = RegExp.$1;
        } else if (option.match(/^@name\s+([^$]+)$/)) {
            thisCommand.name = RegExp.$1.trim();
        } else if (option.match(/^@noerror/)) {
            thisCommand.colorizeStderr = true;
        } else {
            throw new Error("unkown option: " + option);
        }
    }

} catch (e) {
    if (e.code === 'ENOENT') {
        process.stderr.write("couldn't open spinup config: " + spinfile + "\n"); 
    } else {
        process.stderr.write(e.message + "\n");
    }
    process.exit(1);
}

process.on('SIGINT', function() {
    exiting = true;
    process.stderr.write("sending SIGINT to all children...\n");
    if (instance) {
        instance.kill();
    }
});

if (!exiting) {
    instance = spinup(commands, {
        env     : env,
        stdout  : process.stdout,
        stderr  : process.stderr,
        prefix  : prefix
    });
}
