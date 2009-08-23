var file = require("file"),
    jack = require("jack");
    Controller = require("./controller").Controller
    Resource = require("./resource").Resource;

exports.Handler = function(options) {
    options = options || {};
    options.Resource = options.Resource || require("./fileresource").FileResource;
    options.root = options.root || file.cwd();
    
    return function(env) {
        var response = new jack.Response();

        // DEBUG:
        if (env["HTTP_X_LITMUS"]) {
            if (system.verbose) print("==================== " + env["HTTP_X_LITMUS"] + " ====================");
            
            // enable testProperties for testing with Litmus
            if (!Resource.testProperties) Resource.testProperties = {};
        }

        try {
            controller = new Controller(env, response, options);
            
            var method = env["REQUEST_METHOD"].toUpperCase(); // use uppercase thanks to "delete"
            
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
                print("UNCAUGHT ERROR:"+status);
                throw status;
            }
        }

        response.status = response.status || 200;
        
        return response.finish();
    }
}
