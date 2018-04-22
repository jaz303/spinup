var spinup = require('./index');
var fs = require('fs');
var path = require('path');
var dotenv = require('dotenv');
var parse = require('shell-quote').parse;

var config = (function(c) {
    var activeFlag = null;
    process.argv.slice(2).forEach((arg) => {
        if (activeFlag) {
            if (activeFlag === 'group') {
                c.groups = c.groups.concat(arg.split(','));
            }
            activeFlag = null;
        } else if (arg[0] === '-') {
            if (arg === '-g' || arg === '--group') {
                activeFlag = 'group';
            } else {
                throw new Error("Unknown command line option: " + arg);
            }
        } else {
            c.spinfile = arg;
        }
    });
    if (activeFlag) {
        throw new Error("Expected argument for " + activeFlag);
    }
    if (c.groups.length === 0) {
        c.groups = null;
    }
    c.spindir = path.resolve(path.dirname(c.spinfile));
    return c;
})({
    spinfile: 'spin.up',
    groups: []
});

dotenv._getKeysAndValuesFromEnvFilePath(config.spindir + '/.env');
dotenv._setEnvs();

var commands = [],
    instance = null,
    exiting = false,
    prefix = null,
    env = process.env;

const commandOptionHandlers = [
    [/^@cd\s+([^$]+)$/,         (cmd) => { cmd.workingDirectory = RegExp.$1; }],
    [/^@kill\s+([^$]+)$/,       (cmd) => { cmd.killSignal = RegExp.$1; }],
    [/^@name\s+([^$]+)$/,       (cmd) => { cmd.name = RegExp.$1.trim(); }],
    [/^@noerror/,               (cmd) => { cmd.colorizeStderr = true; }],
    [/^@groups?(\s+([\w]+))+$/, (cmd) => { cmd.groups = RegExp.$1.trim().split(/\s+/); }]
];

env.SPINDIR = config.spindir;

try {

    var thisCommand;
    function newCommand() {
        thisCommand = {
            colorizeStderr: false,
            commandLine: null,
            killSignal: 'SIGTERM',
            name: null,
            groups: ['default']
        };
    }
    newCommand();

    var lines = fs
        .readFileSync(config.spinfile, {encoding: 'utf8'})
        .replace(/\\(?:\r\n?|\n)/g, ' ')
        .split(/(?:\r\n?|\n)/)
        .map(function(l) { return l.replace(/^\s*#.*?$/, ''); })
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
        let handled = false;
        for (let i = 0; i < commandOptionHandlers.length; ++i) {
            if (option.match(commandOptionHandlers[i][0])) {
                commandOptionHandlers[i][1](thisCommand);
                handled = true;
                break;
            }
        }
        if (!handled) {
            throw new Error("unkown option: " + option);
        }
    }

} catch (e) {
    if (e.code === 'ENOENT') {
        process.stderr.write("couldn't open spinup config: " + config.spinfile + "\n"); 
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
        prefix  : prefix,
        groups  : config.groups
    });
}
