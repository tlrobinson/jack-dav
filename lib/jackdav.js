print("jackdav!");

//exports.JackDAV = function() { return require("jack/narwhal").app; }
exports.JackDAV = require("./jackdav/handler").Handler;
