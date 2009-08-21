var utils = require("jack/utils"),
    uri = require("uri"),
    dom = require("./dom");

var STATUS = utils.HTTP_STATUS_MESSAGES;

var Controller = exports.Controller = function(request, response, options) {
    var pathInfo = utils.unescape(request.pathInfo());
    
    if (pathInfo.indexOf("..") >= 0)
        throw STATUS["Forbidden"];
    
    this.env = request.env;
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
        this.multistatus(function(xml) {
            this.responseErrors(xml, errors);
        });
    }
}

Controller.prototype.MKCOL = function() {
    this.mapExceptions(function() {
        this.resource.MKCOL()
    });
    this.response.status = STATUS["Created"];
}

Controller.prototype.COPY = function() {
    if (!this.resource.exists())
        throw STATUS["Not Found"];

    var destURI = uri.parse(this.env['HTTP_DESTINATION']),
        destination = uri.unescape(destURI.path);

    if (destURI.host && destURI.host != this.request.host())
        throw STATUS["Bad Gateway"];
    
    if (destination === this.resource.path)
        throw STATUS["Forbidden"];

    var dest = new this.options.Resource(destination, this.options);
    
    if (dest.isCollection())
        dest = dest.child(this.resource.name);

    var destExisted = dest.exists();

    var errors = [];
    this.copyRecursive(this.resource, dest, this.depth(), errors);

    if (errors.length === 0) {
        this.response.status = STATUS["No Content"];
    } else {
        this.multistatus(function(xml) {
            this.responseErrors(xml, errors);
        });
    }
    
    // FIXME:
    //  rescue URI::InvalidURIError => e
    //    raise BadRequest.new(e.message)
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

// end HTTP methods

var serializer = new dom.XMLSerializer();

Controller.prototype.renderXML = function(block) {
    var xml = block.call(this);
    
    this.response.write(serializer.serializeToString(xml));
    this.response.setHeader("Content-Type", 'text/xml; charset="utf-8"');
}

Controller.prototype.multistatus = function(block) {
    this.renderXML(function() {
        var xml = dom.createDocument("DAV:", "D:multistatus", null);
        
        block.call(this, xml.documentElement);
        
        return xml;
    });
    
    this.response.status = STATUS["Multi-Status"];
}

Controller.prototype.responseErrors = function(xml, errors) {
    var doc = xml.ownerDocument,
        path, code, response, href, status;
    
    for (var i = 0; i < errors.length; i++) {
        path = errors[i][0],
        code = errors[i][1];
        
        response = doc.createElement("D:response");
        
        response.appendChild(href = doc.createElement("D:href"));
        href.appendChild(doc.createTextNode("http://"+this.env['HTTP_HOST']+path));
        
        response.appendChild(status = doc.createElement("D:status"));
        status.appendChild(doc.createTextNode(this.env['HTTP_VERSION']+" "+code+" "+utils.HTTP_STATUS_CODES[code]));
        
        xml.appendChild(response);
    }
}

Controller.prototype.mapExceptions = function(block) {
    try {
        block.call(this);
    } catch (e) {
        print("MAPEXCEPTIONS:"+e);
        throw STATUS["Internal Server Error"];
        //throw STATUS["Forbidden"]; //when Errno::EACCES then raise Forbidden
        //throw STATUS["Conflict"]; //when Errno::ENOENT then raise Conflict
        //throw STATUS["Conflict"]; //when Errno::EEXIST then raise Conflict
        //throw STATUS["Insufficient Storage"]; //when Errno::ENOSPC then raise InsufficientStorage
    }
}

Controller.prototype.deleteRecursive = function(resource, errors) {
    var that = this;
    var children = resource.children();
    children.forEach(function(child) {
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

Controller.prototype.copyRecursive = function(resource, dest, depth, errors) {
    try {
        this.mapExceptions(function() {
            if (dest.exists()) {
                if (this.overwrite())
                    this.deleteRecursive(dest, errors);
                else
                    throw STATUS["Precondition Failed"];
            }
            resource.COPY(dest);
        });
    } catch (status) {
        if (typeof status === "number")
            errors.push([resource.path, status]);
        else
            throw status;
    }
    
    if (depth > 0) {
        var children = resource.children();
        for (var i = 0; i < children.length; i++) {
            var child = children[i],
                destChild = dest.child(child.name);
            this.copyRecursive(child, destChild, depth - 1, errors);
        }
    }
}

// helpers

Controller.prototype.depth = function() {
    switch(this.env["HTTP_DEPTH"]) {
        case "0" : return 0;
        case "1" : return 1;
        default : return 100; // FIXME Number.MAX_VALUE?
    }
}

Controller.prototype.overwrite = function() {
    return String(this.env['HTTP_OVERWRITE'] || "").toUpperCase() != 'F';
}
