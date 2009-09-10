var file = require("file");

var STATUS = require("jack/utils").HTTP_STATUS_MESSAGES;

var Resource = exports.Resource = function(path, options) {
    this.path = path;
    this.options = options;
    
    this.root = this.options.root;
    this.filePath = file.join(this.root, this.path);
    this.name = file.basename(this.path);
    
    this.fullPath = (this.options.scriptName || "") + this.path;
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
    
    if (Resource.testProperties) {
        Resource.testProperties[this.path] = Resource.testProperties[this.path] || {};
        var value = Resource.testProperties[this.path][name];
        if (system.verbose) print("GETPROPERTY="+this.path+", "+name +" => " + value);
        if (value === undefined)
            throw STATUS["Not Found"];
        return value;
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
    
    if (Resource.testProperties) {
        Resource.testProperties[this.path] = Resource.testProperties[this.path] || {};
        if (system.verbose) print("SETPROPERTY="+this.path+", "+name+" => "+value);
        if (value === null || value === undefined)
            delete Resource.testProperties[this.path][name];
        else
            Resource.testProperties[this.path][name] = value;
    }
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
