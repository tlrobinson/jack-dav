var utils = require("jack/utils");

var STATUS = utils.HTTP_STATUS_MESSAGES;

var Controller = exports.Controller = function(request, response, options) {
    var pathInfo = utils.unescape(request.pathInfo());
    
    if (pathInfo.indexOf("..") >= 0)
        throw STATUS["Forbidden"];
    
    this.request = request;
    this.response = response;
    this.options = options;
    this.resource = new options.Resource(pathInfo, options);
}

Controller.prototype.OPTIONS = function() {
    this.response.setHeader("Allow", "OPTIONS,HEAD,GET,PUT,POST,DELETE,PROPFIND,PROPPATCH,MKCOL,COPY,MOVE,LOCK,UNLOCK");
    this.response.setHeader("Dav", "2");
    this.response.setHeader("Ms-Author-Via", "DAV");
}

Controller.prototype.HEAD = function() {
    if (!this.resource.exists())
        throw STATUS["Not Found"];
  
    this.response.setHeader('Etag', this.resource.etag());
    this.response.setHeader('Content-Type', this.resource.contentType());
    this.response.setHeader('Last-Modified', this.resource.lastModified().toUTCString());
}

Controller.prototype.GET = function() {
    if (!this.resource.exists())
        throw STATUS["Not Found"];
  
    this.response.setHeader('Etag', this.resource.etag());
    this.response.setHeader('Content-Type', this.resource.contentType());
    this.response.setHeader('Last-Modified', this.resource.lastModified().toUTCString());
    this.response.setHeader('Content-Length', String(this.resource.contentLength()));
    
    this.mapExceptions(function() {
        this.resource.GET(this.request, this.response);
    });
}

Controller.prototype.PUT = function() {
    if (this.resource.isCollection())
        throw STATUS["Forbidden"];
    
    this.mapExceptions(function() {
        this.resource.PUT(this.request, this.response);
    });
}

Controller.prototype.POST = function() {
    this.mapExceptions(function() {
        this.resource.POST(this.request, this.response);
    });
}

Controller.prototype.DELETE = function() {
    var errors = [];
    this.deleteRecursive(this.resource, errors);
    
    if (errors.length === 0) {
        this.response.status = STATUS["No Content"];
    } else {
        // TODO
    }
}

Controller.prototype.MKCOL = function() {
}

Controller.prototype.COPY = function() {
}

Controller.prototype.MOVE = function() {
}

Controller.prototype.PROPFIND = function() {
}

Controller.prototype.PROPPATCH = function() {
}

Controller.prototype.LOCK = function() {
    if (!this.resource.exist())
        throw STATUS["Not Found"];
    
    // TODO
}

Controller.prototype.UNLOCK = function() {
    throw STATUS["No Content"];
}

Controller.prototype.mapExceptions = function(block) {
    try {
        block.call(this);
    } catch (e) {
        throw STATUS["Internal Server Error"];
        //throw STATUS["Forbidden"]; //when Errno::EACCES then raise Forbidden
        //throw STATUS["Conflict"]; //when Errno::ENOENT then raise Conflict
        //throw STATUS["Conflict"]; //when Errno::EEXIST then raise Conflict
        //throw STATUS["Insufficient Storage"]; //when Errno::ENOSPC then raise InsufficientStorage
    }
}

Controller.prototype.deleteRecursive = function(resource, errors) {
    var that = this;
    print("resource="+resource.path);
    var children = resource.children();
    children.forEach(function(child) {
        print("child="+child.path)
        that.deleteRecursive(child, errors);
    });
    
    try {
        this.mapExceptions(function() {
            if (errors.length === 0)
            resource.DELETE();
        });
    } catch (status) {
        if (typeof status === "number")
            errors.push([resource.path, status]);
        else
            throw status;
    }
}