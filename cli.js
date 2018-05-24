const spinup = require('./index');
const fs = require('fs');
const dotenv = require('dotenv');
const parse = require('shell-quote').parse;
const config = require('./private/get-cli-config')();

dotenv._getKeysAndValuesFromEnvFilePath(config.spindir + '/.env');
dotenv._setEnvs();
config.env.SPINDIR = config.spindir;

let instance = null, exiting = false;

const directiveHandlers = [
    [/^\!ports\s+(\$(\w+)\:)?(\d+)((\s+\$\w+)*)\s*$/, () => {
        let base = RegExp.$3;
        if (RegExp.$2 && (RegExp.$2 in config.env)) {
            base = config.env[RegExp.$2];
        }
        base = parseInt(base, 10);
        if (!isFinite(base)) {
            throw new Error("invalid base port; must be numeric");
        }
        RegExp.$4.trim().split(/\s+/).forEach(function(v) {
            config.env[v.substring(1)] = base++;
        });
    }],
    [/^\!noprefix$/, () => {
        config.prefix = false;
    }],
    [/^\!prefix\s+(.*?)$/, () => {
        config.prefix = RegExp.$1;
    }],
    [/^\!(set|default)\s+(\w+)\s+(.*?)$/, () => {
        const op = RegExp.$1, key = RegExp.$2, parsed = parse(RegExp.$3, config.env);
        if (op === 'default' && (key in config.env)) {
            return;
        }
        if (parsed.length !== 1) {
            throw new Error("value for !" + op + " directive must evaluate to a single value (try quoting with \"\")");
        }
        config.env[key] = parsed[0];
    }],
];

const commandOptionHandlers = [
    [/^@cd\s+([^$]+)$/,         (cmd) => { cmd.workingDirectory = RegExp.$1; }],
    [/^@kill\s+([^$]+)$/,       (cmd) => { cmd.killSignal = RegExp.$1; }],
    [/^@name\s+([^$]+)$/,       (cmd) => { cmd.name = RegExp.$1.trim(); }],
    [/^@noerror/,               (cmd) => { cmd.colorizeStderr = true; }],
    [/^@groups?(\s+([\w]+))+$/, (cmd) => { cmd.groups = RegExp.$1.trim().split(/\s+/); }]
];

try {

    let thisCommand;
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

    fs.readFileSync(config.spinfile, {encoding: 'utf8'})
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
                config.commands.push(thisCommand);
                newCommand();
            }
        });

    function applyDirective(directive) {
        for (let i = 0; i < directiveHandlers.length; ++i) {
            if (directive.match(directiveHandlers[i][0])) {
                directiveHandlers[i][1]();
                return;
            }
        }
        throw new Error("unknown directive: " + directive);
    }

    function applyCommandOption(option) {
        for (let i = 0; i < commandOptionHandlers.length; ++i) {
            if (option.match(commandOptionHandlers[i][0])) {
                commandOptionHandlers[i][1](thisCommand);
                return;
            }
        }
        throw new Error("unkown option: " + option);
    }

} catch (e) {
    if (e.code === 'ENOENT') {
        process.stderr.write("couldn't open spinup config: " + config.spinfile + "\n"); 
    } else {
        process.stderr.write(e.message + "\n");
    }
    process.exit(1);
}

function killall() {
    exiting = true;
    process.stderr.write("sending SIGINT to all children...\n");
    if (instance) {
        instance.kill();
    }
}

process.on('SIGINT', killall);
if (!config.daemon) {
    process.on('SIGHUP', killall);
}

if (!exiting) {
    instance = spinup(config.commands, {
        env     : config.env,
        stdout  : process.stdout,
        stderr  : process.stderr,
        prefix  : config.prefix,
        groups  : config.groups
    });
}
