var file = require("file");

var Resource = exports.Resource = function(path, options) {
    this.path = path;
    this.options = options;
    
    this.root = this.options.root;
    this.filePath = file.join(this.root, this.path);
    this.name = file.basename(this.path);
}

Resource.prototype.child = function(name) {
    return new this.options.Resource(file.join(this.path, name), this.options);
}
