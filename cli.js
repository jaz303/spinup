var spinup = require('./index');
var fs = require('fs');

var spinfile = process.argv[2] || 'spin.up';
var commands, instance = null, exiting = false, env = process.env;

try {
    
    commands = fs
        .readFileSync(spinfile, {encoding: 'utf8'})
        .split(/(?:\r\n?|\n)/)
        .map(function(l) { return l.replace(/#.*?$/, ''); })
        .map(function(l) { return l.trim(); })
        .filter(function(l) { return l.length > 0; });

} catch (e) {

    process.stderr.write("couldn't open spinup config: " + spinfile + "\n");
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
        stderr  : process.stderr
    });
}
