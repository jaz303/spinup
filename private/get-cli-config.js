const path = require('path');

const flags = {
    '-g'        : 'group',
    '--group'   : 'group'
};

const flagHandlers = {
    group: (c, arg) => {
        c.groups = c.groups.concat(arg.split(',')); return true;
    }
};

module.exports = function() {
    const c = defaultConfig();

    let activeFlag = null;
    process.argv.slice(2).forEach((arg) => {
        if (activeFlag) {
            if (flagHandlers[activeFlag](c, arg)) {
                activeFlag = null;
            }
        } else if (arg[0] === '-') {
            activeFlag = flags[arg];
            if (!activeFlag) {
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

function defaultConfig() {
    return {
        spinfile: 'spin.up',
        groups: [],
        prefix: null,
        commands: [],
        env: process.env
    };
}