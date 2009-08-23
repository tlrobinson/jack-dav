var file = require("file"),
    sprintf = require("printf").sprintf,
    utils = require("jack/utils"),
    mimeType = require("jack/mime").mimeType,
    dom = require("./dom"),
    Resource = require("./resource").Resource,
    Directory = require("jack/dir").Directory,
    File = require("jack/file").File;

var STATUS = utils.HTTP_STATUS_MESSAGES;

var FileResource = exports.FileResource = function(path, options) {
    Resource.apply(this, arguments);
}

FileResource.prototype = new Resource("", {});

FileResource.prototype.children = function() {
    if (!file.isDirectory(this.filePath))
        return [];
    
    return file.list(this.filePath).map(function(path) {
        return this.child(path);
    }, this);
}


// Is this resource a collection?
FileResource.prototype.isCollection = function() {
    return file.isDirectory(this.filePath);
}

// Does this recource exist?
FileResource.prototype.exists = function() {
    return file.exists(this.filePath);
}

// Return the creation time.
FileResource.prototype.creationDate = function() {
    // FIXME
    return file.mtime(this.filePath);
    //return file.ctime(this.filePath);
}

// Return the time of last modification.
FileResource.prototype.lastModified = function() {
    return file.mtime(this.filePath);
}
  
// Set the time of last modification.
FileResource.prototype.setLastModified = function(time) {
    // FIXME
    print("setLastModified not implemented");
}

// Return an Etag, an unique hash value for this resource.
FileResource.prototype.etag = function() {
    // FIXME: inode
    return sprintf('%x-%x',
        file.size(this.filePath),
        Math.round(file.mtime(this.filePath).getTime()/1000)
    )
//    sprintf('%x-%x-%x', stat.ino, stat.size, stat.mtime.to_i)
}

// Return the resource type.
//
// If this is a collection, return
// REXML::Element.new('D:collection')
FileResource.prototype.resourceType = function() {
    if (this.isCollection()) {
        var doc = dom.createDocument("DAV:", "D:multistatus", null);
        return doc.createElement("D:collection");
    }
//    if collection?
//      REXML::Element.new('D:collection')
//  }
}

// Return the mime type of this resource.
FileResource.prototype.contentType = function() {
    if (file.isDirectory(this.filePath))
        return "text/html";
    else
        return mimeType(this.filePath);
//    if stat.directory?
//      "text/html"
//    else 
//      mime_type(this.filePath, DefaultMimeTypes)
//  }
}

// Return the size in bytes for this resource.
FileResource.prototype.contentLength = function() {
    return file.size(this.filePath);
//    stat.size
}

// HTTP GET request.
//
// Write the content of the resource to the response.body.
FileResource.prototype.GET = function(env, response) {
    if (file.isDirectory(this.filePath)) {
        Directory(this.root)(env)[2].forEach(function(chunk) {
            response.write(chunk);
        }, this);
        response.setHeader('Content-Length', String(response.length));
    } else {
        // FIXME: return the input stream?
        response.write(file.read(this.filePath, { mode : "b" }));
    }
}

// HTTP PUT request.
//
// Save the content of the request.body.
FileResource.prototype.PUT = function(env, response) {
    this.write(env["jack.input"]);
}
  
// HTTP POST request.
//
// Usually forbidden.
FileResource.prototype.POST = function(env, response) {
    throw STATUS["Forbidden"];
}
  
// HTTP DELETE request.
//
// Delete this resource.
FileResource.prototype.DELETE = function() {
    if (file.isDirectory(this.filePath)) {
        file.rmdir(this.filePath);
    } else {
        file.remove(this.filePath);
    }
    
    if (Resource.testProperties)
        delete Resource.testProperties[this.path];
}
  
// HTTP COPY request.
//
// Copy this resource to given destination resource.
FileResource.prototype.COPY = function(dest) {
    if (file.isDirectory(this.filePath)) {
        dest.MKCOL();
    } else {
        var io = file.open(this.filePath, "rb")
        dest.write(io);
    }
    
    if (Resource.testProperties) {
        Resource.testProperties[dest.path] = {};
        for (var prop in Resource.testProperties[this.path])
            Resource.testProperties[dest.path][prop] = Resource.testProperties[this.path][prop];
    }
}

// HTTP MOVE request.
//
// Move this resource to given destination resource.
FileResource.prototype.MOVE = function(dest) {
    this.COPY(dest);
    this.DELETE();
}
  
// HTTP MKCOL request.
//
// Create this resource as collection.
FileResource.prototype.MKCOL = function() {
    file.mkdir(this.filePath);
}

// Write to this resource from given IO.
FileResource.prototype.write = function(io) {
    // FIXME "#{this.filePath}.#{Process.pid}.#{object_id}"
    var tempFile = this.filePath + "-" + Math.random() + ".tmp";

    var data = io.read();

    file.write(tempFile, data, { mode : "b" });
    file.rename(tempFile, this.filePath);
}
