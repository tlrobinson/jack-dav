var utils = require("jack/utils"),
    uri = require("uri"),
    dom = require("./dom");

var STATUS = utils.HTTP_STATUS_MESSAGES;

var Controller = exports.Controller = function(env, response, options) {
    var pathInfo = utils.unescape(env["PATH_INFO"]);
    
    if (pathInfo.indexOf("..") >= 0)
        throw STATUS["Forbidden"];
    
    if (env["SCRIPT_NAME"])
        options.scriptName = utils.unescape(env["SCRIPT_NAME"]);
    
    this.env = env;
    this.response = response;
    this.options = options;
    this.resource = new options.Resource(pathInfo, options);
}

Controller.prototype.OPTIONS = function() {
    if (this.options.class2) {
        this.response.setHeader("Allow", "OPTIONS,HEAD,GET,PUT,POST,DELETE,PROPFIND,PROPPATCH,MKCOL,COPY,MOVE,LOCK,UNLOCK");
        this.response.setHeader("Dav", "1,2");
    } else {    
        this.response.setHeader("Allow", "OPTIONS,HEAD,GET,PUT,POST,DELETE,PROPFIND,PROPPATCH,MKCOL,COPY,MOVE");
        this.response.setHeader("DAV", "1");
    }
    this.response.setHeader("MS-Author-Via", "DAV");
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
        this.resource.GET(this.env, this.response);
    });
}

Controller.prototype.PUT = function() {
    if (this.resource.isCollection())
        throw STATUS["Forbidden"];
    
    this.mapExceptions(function() {
        this.resource.PUT(this.env, this.response);
    });
    
    this.response.status = STATUS["Created"];
}

Controller.prototype.POST = function() {
    this.mapExceptions(function() {
        this.resource.POST(this.env, this.response);
    });
}

Controller.prototype.DELETE = function() {
    if (!this.resource.exists())
        throw STATUS["Not Found"];
    
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
    if (this.resource.exists())
        throw STATUS["Method Not Allowed"];
    
    var body = (this.env["jsgi.input"] || this.env["jack.input"]).read();
    if (body.length > 0)
        throw STATUS["Unsupported Media Type"];
    
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

    if (destURI.host && destURI.host != this.host())
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
        this.response.status = destExisted ? STATUS["No Content"] : STATUS["Created"];
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
    if (!this.resource.exists())
        throw STATUS["Not Found"];

    var destURI = uri.parse(this.env['HTTP_DESTINATION']),
        destination = uri.unescape(destURI.path);

    if (destURI.host && destURI.host != this.host())
        throw STATUS["Bad Gateway"];

    if (destination === this.resource.path)
        throw STATUS["Forbidden"];

    var dest = new this.options.Resource(destination, this.options);

    if (dest.isCollection())
        dest = dest.child(this.resource.name);

    var destExisted = dest.exists();

    if (this.depth <= 1)
        throw STATUS["Conflict"];

    var errors = [];
    this.copyRecursive(this.resource, dest, this.depth(), errors);
    this.deleteRecursive(this.resource, errors);

    if (errors.length === 0) {
        this.response.status = destExisted ? STATUS["No Content"] : STATUS["Created"];
    } else {
        this.multistatus(function(xml) {
            this.responseErrors(xml, errors);
        });
    }
    
    // FIXME:
    //  rescue URI::InvalidURIError => e
    //    raise BadRequest.new(e.message)
}

Controller.prototype.PROPFIND = function() {
    if (!this.resource.exists())
        throw STATUS["Not Found"];

    var names;
    if (this.requestMatch("/propfind/allprop").length > 0) {
        names = this.resource.propertyNames();
    } else {
        names = this.requestMatch("/propfind/prop/*").map(function(prop) {
            return [String(prop.nodeName), prop.getAttribute("xmlns")];
            // strip the namespace
            //return String(prop.nodeName).match(/^(.*:)?(.*)$/)[2];
        }, this);
    }
    if (names.length <= 0)
        throw STATUS["Bad Request"];

    this.multistatus(function(xml) {
        var doc = xml.ownerDocument;
        this.findResources().forEach(function(resource) {
            var response, href;
            
            xml.appendChild(response = doc.createElement("D:response"));

            response.appendChild(href = doc.createElement("D:href"));
            href.appendChild(doc.createTextNode("http://"+this.env['HTTP_HOST']+resource.fullPath));
            
            this.propstats(response, this.getProperties(resource, names));
        }, this);
    });
}

Controller.prototype.PROPPATCH = function() {
    if (!this.resource.exists())
        throw STATUS["Not Found"];

    propPatch = this.requestMatch("/propertyupdate/set/prop/* | /propertyupdate/remove/prop/*").map(function(prop) {
        var remove = String(prop.parentNode.parentNode.nodeName).indexOf("remove") >= 0,
            value = remove ? null : String(prop.firstChild.nodeValue);
        return [
            [String(prop.nodeName), prop.getAttribute("xmlns")],
            value
        ];
    });
    
    this.multistatus(function(xml) {
        var doc = xml.ownerDocument;
        this.findResources().forEach(function(resource) {
            var response, href;
            
            xml.appendChild(response = doc.createElement("D:response"));

            response.appendChild(href = doc.createElement("D:href"));
            href.appendChild(doc.createTextNode("http://"+this.env['HTTP_HOST']+resource.fullPath));
            
            this.propstats(response, this.setProperties(resource, propPatch));
        }, this);
    });
}

Controller.prototype.LOCK = function() {
    if (!this.resource.exists())
        throw STATUS["Not Found"];
    
    // TODO
}

Controller.prototype.UNLOCK = function() {
    throw STATUS["No Content"];
}

// end HTTP methods

// XML helpers:

var serializer = new dom.XMLSerializer();

Controller.prototype.renderXML = function(block) {
    var xml = block.call(this);
    
    var body = serializer.serializeToString(xml);
    
    /*
    print("--- vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv")
    print(body.replace(/\n$/, ""))
    print("--- ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^")
    //*/
    
    this.response.write(body);
    this.response.setHeader("Content-Type", 'text/xml; charset="utf-8"');
}

Controller.prototype.requestDocument = function() {
    try {
        if (!this.requestDoc) {
            var body = (this.env["jsgi.input"] || this.env["jack.input"]).read().decodeToString("UTF-8");
            
            /*
            print("+++ vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv")
            print(body.replace(/\n$/, ""))
            print("+++ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^")
            //*/
            
            this.requestDoc = new dom.DOMParser().parseFromString(body, "text/xml");
            
            // HACK? For Litmus. Matchs elements that have named null namespaces, i.e. xmlns:bar=""
            if (this.requestMatch("//namespace::*[.='' and name()!='']").length > 0)
                throw STATUS["Bad Request"]; 
        }
        return this.requestDoc;
    } catch (e) {
        throw STATUS["Bad Request"];
    }
}

var nsMapper = function(ns) { return ns === "" ? "DAV:" : null; }

Controller.prototype.requestMatch = function(pattern) {
    var doc = this.requestDocument(),
        result = dom.evaluate(pattern, doc, nsMapper, dom.XPathResult.UNORDERED_NODE_ITERATOR_TYPE);
    
    var node, array = [];
    while (node = result.iterateNext())
        array.push(node);
    
    return array;
}

Controller.prototype.multistatus = function(block) {
    this.renderXML(function() {
        var doc = dom.createDocument("DAV:", "D:multistatus", null);
        
        block.call(this, doc.documentElement);
        
        return doc;
    });
    
    this.response.status = STATUS["Multi-Status"];
}

Controller.prototype.propstats = function(xml, stats) {
    var doc = xml.ownerDocument;
    
    for (var status in stats) {
        var props = stats[status];
        var propstat, prop, propContents, statusNode;
        
        xml.appendChild(propstat = doc.createElement("D:propstat"));
        
        propstat.appendChild(prop = doc.createElement("D:prop"));
        
        props.forEach(function(p) {
            var name = p[0][0], xmlns = p[0][1], value = p[1];
            
            //if (value) {
                prop.appendChild(propContents = doc.createElement(name));
                if (xmlns) propContents.setAttribute("xmlns", xmlns);
                if (value instanceof dom.Node)
                    propContents.appendChild(doc.adoptNode(value));
                else
                    propContents.appendChild(doc.createTextNode(value || ""));
            //}
            
        }, this);
        
        propstat.appendChild(statusNode = doc.createElement("D:status"));
        statusNode.appendChild(doc.createTextNode(this.httpStatusLine(status)));
    }
}

Controller.prototype.responseErrors = function(xml, errors) {
    var doc = xml.ownerDocument,
        path, code, response, href, status;
    
    errors.forEach(function(error) {
        path = error[0],
        code = error[1];
        
        response = doc.createElement("D:response");
        
        response.appendChild(href = doc.createElement("D:href"));
        href.appendChild(doc.createTextNode("http://"+this.env['HTTP_HOST']+path));
        
        response.appendChild(status = doc.createElement("D:status"));
        status.appendChild(doc.createTextNode(this.httpStatusLine(code)));
        
        xml.appendChild(response);
    }, this);
}

// misc helpers

Controller.prototype.mapExceptions = function(block) {
    try {
        block.call(this);
    } catch (e) {
        if (typeof e === "number")
            throw e;
        
        if (e.message && e.message.indexOf("failed to make directory") >= 0)
            throw STATUS["Conflict"];
        
        //throw STATUS["Conflict"]; //when Errno::ENOENT then raise Conflict
        // FIXME
        if (typeof Packages !== "undefined" && e.javaException instanceof Packages.java.io.FileNotFoundException)
            throw STATUS["Conflict"];
        
        if (system.verbose) {
            print("MAPEXCEPTIONS:["+e+"]["+e.message+"]");
            if (e.rhinoException)
                e.rhinoException.printStackTrace();
            else if(e.javaException)
                e.javaException.printStackTrace();
        }

        throw STATUS["Internal Server Error"];
        //throw STATUS["Forbidden"]; //when Errno::EACCES then raise Forbidden
        //throw STATUS["Conflict"]; //when Errno::EEXIST then raise Conflict
        //throw STATUS["Insufficient Storage"]; //when Errno::ENOSPC then raise InsufficientStorage
    }
}

Controller.prototype.deleteRecursive = function(resource, errors) {
    var children = resource.children();
    children.forEach(function(child) {
        this.deleteRecursive(child, errors);
    }, this);
    
    try {
        this.mapExceptions(function() {
            if (errors.length === 0)
                resource.DELETE();
        });
    } catch (status) {
        if (typeof status === "number")
            errors.push([resource.fullPath, status]);
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
            errors.push([resource.fullPath, status]);
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

Controller.prototype.getProperties = function(resource, names) {
    var stats = { 200 : [] };
    names.forEach(function(name) {
        var nameWithoutPrefix = name[0].match(/^(.*:)?(.*)$/)[2]; // strip the namespace prefix
        try {
            this.mapExceptions(function() {
                stats[200].push([name, resource.getProperty(nameWithoutPrefix)]);
            });
        } catch (status) {
            if (typeof status === "number") {
                stats[status] = stats[status] || [];
                stats[status].push([name]);
            } else
                throw status;
        }
    }, this);
    return stats;
}

Controller.prototype.setProperties = function(resource, pairs) {
    var stats = { 200 : [] };
    pairs.forEach(function(pair) {
        var name = pair[0], value = pair[1];
        var nameWithoutPrefix = name[0].match(/^(.*:)?(.*)$/)[2]; // strip the namespace prefix
        try {
            this.mapExceptions(function() {
                stats[200].push([name, resource.setProperty(nameWithoutPrefix, value)]);
            });
        } catch (status) {
            if (typeof status === "number") {
                stats[status] = stats[status] || [];
                stats[status].push([name]);
            } else
                throw status;
        }
    }, this);
    return stats;
}

Controller.prototype.findResources = function() {
    switch(this.depth()) {
        case 0:
            return [this.resource];
        case 1:
            return [this.resource].concat(this.resource.children());
        default:
            return [this.resource].concat(this.resource.descendants());
    }
}

// HTTP helpers

Controller.prototype.httpStatusLine = function(code) {
    return this.env['HTTP_VERSION']+" "+code+" "+utils.HTTP_STATUS_CODES[code];
}

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

Controller.prototype.host = function() {
    return (this.env["HTTP_HOST"] || this.env["SERVER_NAME"]).replace(/:\d+\z/g, "");
}
