var spinup = require('./index');
var fs = require('fs');

var spinfile = process.argv[2] || 'spin.up';
var commands, instance = null, exiting = false, prefix, env = process.env;

try {
    
    commands = fs
        .readFileSync(spinfile, {encoding: 'utf8'})
        .split(/(?:\r\n?|\n)/)
        .map(function(l) { return l.replace(/#.*?$/, ''); })
        .map(function(l) { return l.trim(); })
        .filter(function(l) { return l.length > 0; });

    while (commands.length && commands[0].charAt(0) === '!') {
        var directive = commands.shift();
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
        } else if (directive.match(/^\!prefix\s+(.*?)$/)) {
            prefix = RegExp.$1;
        } else {
            throw new Error("unknown directive: " + directive);
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
