var spinup = require('./index');
var fs = require('fs');

var commands, instance = null, exiting = false;

try {
    
    commands = fs
        .readFileSync('spin.up', {encoding: 'utf8'})
        .split(/(?:\r\n?|\n)/)
        .map(function(l) { return l.replace(/#[^$]*$/, ''); })
        .map(function(l) { return l.trim(); })
        .filter(function(l) { return l.length > 0; });

} catch (e) {

    process.stderr.write("no spin.up file found!\n");
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
    instance = spinup(commands);
}
