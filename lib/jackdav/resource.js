var file = require("file");

var STATUS = require("jack/utils").HTTP_STATUS_MESSAGES;

var Resource = exports.Resource = function(path, options) {
    this.path = path;
    this.options = options;
    
    this.root = this.options.root;
    this.filePath = file.join(this.root, this.path);
    this.name = file.basename(this.path);
}

Resource.prototype.displayName = function() {
    return this.name;
}

Resource.prototype.child = function(name) {
    return new this.options.Resource(file.join(this.path, name), this.options);
}

Resource.prototype.propertyNames = function() {
    return "creationdate displayname getlastmodified getetag resourcetype getcontenttype getcontentlength".split(" ");
}

Resource.prototype.getProperty = function(name) {
    switch (name) {
        case 'resourcetype'     : return this.resourceType();
        case 'displayname'      : return this.displayName();
        case 'creationdate'     : return this.creationDate().toUTCString(); 
        case 'getcontentlength' : return String(this.contentLength());
        case 'getcontenttype'   : return this.contentType();
        case 'getetag'          : return this.etag();
        case 'getlastmodified'  : return this.lastModified().toUTCString();
    }
}

Resource.prototype.setProperty = function(name, value) {
    //try {
        switch (name) {
            case 'resourcetype'     : return this.setResourceType(value);
            case 'getcontenttype'   : return this.setContentType(value);
            case 'getetag'          : return this.setEtag(value);
            case 'getlastmodified'  : return this.setLastModified(new Date(value));
        }
    //} catch (e) {
    //    throw STATUS["Conflict"];
    //}
}

Resource.prototype.removeProperty = function(name) {
    throw STATUS["Forbidden"];
}

Resource.prototype.descendants = function() {
    var list = [];
    
    this.children().forEach(function(child) {
        list.push(child);
        list.concat(child.descendants());
    }, this);
    
    return list;
}
