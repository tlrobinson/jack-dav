var file = require("file"),
    jack = require("jack");
    Controller = require("./controller").Controller;

exports.Handler = function(options) {
    options = options || {};
    options.Resource = options.Resource || require("./fileresource").FileResource;
    options.root = options.root || file.cwd();
    
    return function(env) {
        var request = new jack.Request(env),
            response = new jack.Response();

        try {
            controller = new Controller(request, response, options);
            
            var method = request.requestMethod().toUpperCase(); // use uppercase thanks to "delete"
            
            if (controller[method]) {
                controller[method]();
            }
            else {
                response.status = jack.Utils.HTTP_STATUS_MESSAGES['Method Not Allowed'];
            }
            
        } catch (status) {
            if (typeof status === "number")
                response.status = status;
            else {
                print("ERROR:"+status);
                throw status;
            }
        }

        response.status = response.status || 200;
        
        return response.finish();
    }
}
