const path = require('path');

module.exports = function() {
    const c = {
        spinfile: 'spin.up',
        groups: []
    };

    let activeFlag = null;
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
}