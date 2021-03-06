//Copyright (C) 2012 Kory Nunn, Matt Ginty & Maurice Butler

//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

(function (undefined) {
    "use strict";

    //Create gaffa
    var gedi,
        gaffa = window.gaffa = {},
        history = window.History || window.history; //Allow custom history implementations if defined.

    //"constants"
    gaffa.pathSeparator = "/";
    gaffa.pathWildcard = "*";
    
    //internal varaibles
    
        // Storage for the applications model.
    var internalModel = {},
    
        // Storage for the applications view.
        internalViewItems = [],
        
        // Storage for application actions.
        internalActions = {},
        
        // Storage for application behaviours.
        internalBehaviours = [],
        
        // Storage for application notifications.
        internalNotifications = {},
        
        // Storage for interval based behaviours.
        internalIntervals = [],
        
        // Storage for applications default styles.
        defaultViewStyles;
        
        
    // Gedi initialisation
    gedi = new window.Gedi(internalModel);

    // Add gedi instance to gaffa.
    gaffa.gedi = gedi;
    
    // Gel extensions
    
    function getSourceKeys(array){            
        return array.__gaffaKeys__ || (function(){
            var arr = [];
            while(arr.length < array.length && arr.push(arr.length.toString()));
            return arr;
        })();
    }

    var originalFilter = gedi.gel.functions.filter;
    gedi.gel.functions.filter = function(scope, args) {
        if(!scope.get('__trackKeys__')){
            return originalFilter(scope, args);
        }
        var args = args.all(),
            sourceArrayKeys,
            filteredList = [];
        
        var array = args[0];
        var functionToCompare = args[1];

        if(!array){
            return undefined;
        }
            
        sourceArrayKeys = getSourceKeys(array);

        filteredList.__gaffaKeys__ = [];
            
        if (args.length < 2) {
            return args;
        }
        
        if (Array.isArray(array)) {
            
            array.fastEach(function(item, index){
                if(typeof functionToCompare === "function"){
                    if(gedi.gel.callWith(functionToCompare, scope, [item])){ 
                        filteredList.push(item);
                        filteredList.__gaffaKeys__.push(sourceArrayKeys[index]);
                    }
                }else{
                    if(item === functionToCompare){ 
                        filteredList.push(item);
                        filteredList.__gaffaKeys__.push(sourceArrayKeys[index]);
                    }
                }
            });
            return filteredList;
        
        }else {
            return;
        }
    };
    
    var originalSlice = gedi.gel.functions.slice;
    gedi.gel.functions.slice = function(scope, args) {
        if(!scope.get('__trackKeys__')){
            return originalSlice(scope, args);
        }
        var target = args.next(),
            start,
            end,
            result,
            sourceArrayKeys;

        if(args.hasNext()){
            start = target;
            target = args.next();
        }
        if(args.hasNext()){
            end = target;
            target = args.next();
        }

        if(!Array.isArray(target)){
            return;
        }

        sourceArrayKeys = getSourceKeys(target);

        result = target.slice(start, end);

        result.__gaffaKeys__ = sourceArrayKeys.slice(start, end);
        
        return result;
    };

    // This is pretty dirty..
    function ksort(array, scope, sortFunction){

        if(array.length < 2){
            return array;
        }

        var sourceArrayKeys = getSourceKeys(array),
            source = array.slice(),
            sourceKeys = sourceArrayKeys.slice(),
            left = [],
            pivot = source.splice(source.length/2,1).pop(),
            pivotKey = sourceKeys.splice(sourceKeys.length/2,1).pop(),
            right = [],
            result,
            resultKeys;

        left.__gaffaKeys__ = [];
        right.__gaffaKeys__ = [];

        for(var i = 0; i < source.length; i++){
            var item = source[i];
            if(gedi.gel.callWith(sortFunction, scope, [item, pivot]) > 0){           
                right.push(item);
                right.__gaffaKeys__.push(sourceKeys[i]);
            }else{
                left.push(item);
                left.__gaffaKeys__.push(sourceKeys[i]);
            }
        }

        left = ksort(left, scope, sortFunction);

        left.push(pivot);
        left.__gaffaKeys__.push(pivotKey);

        right = ksort(right, scope, sortFunction);

        resultKeys = left.__gaffaKeys__.concat(right.__gaffaKeys__);

        result = left.concat(right);
        result.__gaffaKeys__ = resultKeys;

        return result;
    }
    
    var originalSort = gedi.gel.functions.sort;
    gedi.gel.functions.sort = function(scope, args) {
        if(!scope.get('__trackKeys__')){
            return originalSort(scope, args);
        }

        var target = args.next(),
            sortFunction = args.next(),
            result,
            sourceArrayKeys,
            sortValues = [];

        if(!Array.isArray(target)){
            return;
        }

        result = ksort(target, scope, sortFunction);
        
        return result;
    };
        
    // Gedi Specs.
    var Path = gedi.Path,
        Expression = gedi.Expression;

    //internal functions
    
    //***********************************************
    //
    //      Object.create polyfill
    //      https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/create
    //
    //***********************************************
    
    Object.create = Object.create || function (o) {
        if (arguments.length > 1) {
            throw new Error('Object.create implementation only accepts the first parameter.');
        }
        function F() {}
        F.prototype = o;
        return new F();
    };
    
    
    //***********************************************
    //
    //      Create Spec
    //      https://github.com/KoryNunn/JavascriptInheritance/blob/master/spec.js
    //
    //***********************************************
    
    function createSpec(child, parent){
        var parentPrototype;
        
        if(!parent) {
            parent = Object;
        }
        
        if(!parent.prototype) {
            parent.prototype = {};
        }
        
        parentPrototype = parent.prototype;
        
        child.prototype = Object.create(parent.prototype);
        child.prototype.__super__ = parentPrototype;
        
        // Yes, This is 'bad'. However, it runs once per Spec creation.
        var spec = new Function("child", "return function " + child.name + "(){child.prototype.__super__.constructor.apply(this, arguments);return child.apply(this, arguments);}")(child);
        
        spec.prototype = child.prototype;
        spec.prototype.constructor = child.prototype.constructor = spec;
        
        return spec;
    }
    
    
    //***********************************************
    //
    //      IE indexOf polyfill
    //
    //***********************************************

    //IE Specific idiocy

    Array.prototype.indexOf = Array.prototype.indexOf || function(object) {
        this.fastEach(function(value, index) {
            if (value === object) {
                return index;
            }
        });
    };
    
    // http://stackoverflow.com/questions/498970/how-do-i-trim-a-string-in-javascript
    String.prototype.trim=String.prototype.trim||function(){return this.replace(/^\s\s*/, '').replace(/\s\s*$/, '');};

    // http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
    Array.isArray = Array.isArray || function(obj){
        return Object.prototype.toString.call(obj) === '[object Array]';
    };

    //End IE land.


    //***********************************************
    //
    //      Array Fast Each
    //
    //***********************************************

    Array.prototype.fastEach = function (callback) {
        for (var i = 0; i < this.length; i++) {
            if(callback(this[i], i, this)) break;
        }
        return this;
    };
    

    //***********************************************
    //
    //      String Formatter
    //
    //***********************************************

    //http://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format/4673436#4673436
    //changed to a single array argument
    String.prototype.format = function (values) {
        return this.replace(/{(\d+)}/g, function (match, number) {
            return (values[number] == undefined || values[number] == null) ? match : values[number];
        }).replace(/{(\d+)}/g, "");
    };

    
    //***********************************************
    //
    //      String De-Formatter
    //
    //***********************************************

    //http://stackoverflow.com/questions/5346158/parse-string-using-format-template
    //Haxy de-formatter
    String.prototype.deformat = function (template) {

        var findFormatNumbers = /{(\d+)}/g,
            currentMatch,
            matchOrder = [],
            index = 0;

        while ((currentMatch = findFormatNumbers.exec(template)) != null) {
            matchOrder[index] = parseInt(currentMatch[1]);
            index++;
        }

        //http://simonwillison.net/2006/Jan/20/escape/
        var pattern = new RegExp("^" + template.replace(/[-[\]()*+?.,\\^$|#\s]/g, "\\$&").replace(/(\{\d+\})/g, "(.*?)") + "$", "g");

        var matches = pattern.exec(this);

        if (!matches) {
            return false;
        }

        var values = [];

        for (var i = 0; i < matchOrder.length; i++) {
            values.push(matches[matchOrder[i] + 1]);
        }

        return values;
    };

    //***********************************************
    //
    //      QueryString To Model
    //
    //***********************************************
    
    function queryStringToModel(){
        var queryStringData = window.location.search.slice(1).split("&");
        
        queryStringData.fastEach(function(keyValue){
            var parts = keyValue.split("="),
                key = window.unescape(parts[0]),
                value = window.unescape(parts[1]);
                
            if(key){
                if(value){
                    gaffa.model.set(new Path(key), value);
                }else{
                    gaffa.model.set(new Path(key), null);
                }
            }
        });
    }

    //***********************************************
    //
    //      Navigate
    //
    //***********************************************

    function navigate(url, model, post, pushState) {
        
        gaffa.notifications.notify("navigation.begin");
        $.ajax({
        
            // Internet explorer is an ABSOLUTE PIECE OF SHIT.
            // If you don't set this to false, it JUST RESPONDS WITH WHATEVER IT LAST GOT FROM THAT URL.
            // Changed the contentType to application/json? WHO CARES! JUST FUCKING RESPOND WITH HTML :D!
            // I fucking hate internet explorer.
            // Also dodgey browser detection cause cant feature detect shitness.
            cache: navigator.appName !== 'Microsoft Internet Explorer',
            url: url,
            type: (post && "post") || "get",
            contentType: "application/json; charset=utf-8",
            data: "gaffaNavigate=1", // This is to avoid the cached HTML version of a page if you are bootstrapping.
            dataType: "json",
            success: function (data) {
                var title;
                        
                if(data !== undefined && data !== null && data.title){
                    title = data.title;
                }
                
                // Always use pushstate unless triggered by onpopstate
                if(pushState !== false) {
                    history.pushState(data, title, url);
                }
                
                load(data, model);
                
                gaffa.notifications.notify("navigation.success");
                
                window.scrollTo(0,0);
            },
            error: function(error){
                gaffa.notifications.notify("navigation.error", error);
            },
            complete: function(){
                gaffa.notifications.notify("navigation.complete");
            }
        });
    }
    
    //***********************************************
    //
    //      Pop State
    //
    //***********************************************

     // ToDo: Pop state no worksies in exploder.
    window.onpopstate = function(event){
        if(event.state){
        
            navigate(window.location.toString(),undefined,undefined,false);
            
            //load(event.state);
            
        }
    };

    //***********************************************
    //
    //      Load
    //
    //***********************************************
    
    function load(app, model){
    
        while(internalIntervals.length){
            clearInterval(internalIntervals.pop());
        }

        //clear state first
        if (app.views) {
            gaffa.views.remove();
        }
        
        //set up state
        if (app.model) {
            gedi.set({});
            gaffa.model.set(app.model, null, null, false);
        }
        if (app.views) {
            gaffa.views.add(app.views);
        }
        if (app.behaviours) {
            gaffa.behaviours.add(app.behaviours);
        }
        if (app.model && model) {
            var newModel = extend({}, app.model, model);
            gaffa.model.set(newModel);
        }
        
        queryStringToModel();
    }
    
       
    //***********************************************
    //
    //      Get Distinct Groups
    //
    //***********************************************
    
    function getDistinctGroups(collection, expression){
        var distinctValues = {},
            values = gaffa.model.get('(map items ' + expression + ')', {items: collection});
        
        if(collection && typeof collection === "object"){
            if(Array.isArray(collection)){
                values.fastEach(function(value){
                    distinctValues[value] = null;
                });
            }else{
                throw "Object collections are not currently supported";
            }
        }
        
        return Object.keys(distinctValues);
    }

    //***********************************************
    //
    //      De-Dom
    //
    //***********************************************
    
    function deDom(node){
        var parent = node.parentNode,
            nextSibling;
            
        if(!parent){
            return false;
        }
        
        nextSibling = node.nextSibling;
            
        parent.removeChild(node);
        
        return function(){
            if(nextSibling){
                parent.insertBefore(node, nextSibling && nextSibling.parent && nextSibling);
            }else {
                parent.appendChild(node);
            }
        };
    }

    //***********************************************
    //
    //      Trigger Action
    //
    //***********************************************

    function triggerAction(action) {
        action.trigger();
    }

    
    //***********************************************
    //
    //      Insert Function
    //
    //***********************************************

    function insertFunction(selector, renderedElement){
        document.querySelectorAll(selector)[0].appendChild(renderedElement);
    }
    
    //***********************************************
    //
    //      Get ViewItem Path
    //
    //***********************************************
    
    function getItemPath(item){
        var path;
        
        if(item.__pathCache__){
            return item.__pathCache__;
        }
        
        if(item instanceof ViewItem && item.parentContainer && item.parentContainer.getPath){
            path = item.parentContainer.getPath();
        }else if(item instanceof ViewContainer && item.property && item.property.getPath){
            
            if(item.property.binding instanceof Expression && item.property.binding.length === 1 && item.property.binding.paths.length === 1){
                path = item.property.getPath().append(item.property.binding.paths[0]);
            }else{
                path = item.property.getPath();
            }
        }else if(item.parent && item.parent.getPath){
            path = item.parent.getPath();
        }else{
            path = new Path();
        }
        
        item.__pathCache__ = path.append(item.key, item.path);
        
        return item.__pathCache__;
    }
    
    //***********************************************
    //
    //      Extend
    //
    //***********************************************
    
    function extend(target, source){
        var args = Array.prototype.slice.call(arguments),
            target = args[0] || {},
            source = args[1] || {},
            visited = [];
        
        function internalExtend(target, source){
            for(var key in source){
                var sourceProperty = source[key],
                    targetProperty = target[key];
                                                            
                if(typeof sourceProperty === "object" && sourceProperty != null){
                    if(sourceProperty instanceof Array){
                        targetProperty = new sourceProperty.constructor();
                        sourceProperty.fastEach(function(value){
                            var item = new value.constructor();
                            internalExtend(item, value);
                            targetProperty.push(item);
                        });
                    }else{
                        if(visited.indexOf(sourceProperty)>=0){
                            target[key] = sourceProperty;
                            continue;
                        }
                        visited.push(sourceProperty);
                        targetProperty = targetProperty || Object.create(sourceProperty);
                        internalExtend(targetProperty, sourceProperty);
                    }
                }else{
                    if(targetProperty === undefined){
                        targetProperty = sourceProperty;
                    }
                }
                target[key] = targetProperty;
            }
        }
        
        internalExtend(target, source);
        
        if(args[2] !== undefined && args[2] !== null){
            args[0] = args.shift();
            extend.apply(this, args);
        }
        
        return target;
    }
    
    //***********************************************
    //
    //      Add Notification
    //
    //***********************************************
    
    function addNotification(kind, callback){
        internalNotifications[kind] = internalNotifications[kind] || [];
        internalNotifications[kind].push(callback);
    }
    
    //***********************************************
    //
    //      Notify
    //
    //***********************************************
    
    function notify(kind, data){
        var subKinds = kind.split(".");
            
        subKinds.fastEach(function(subKind, index){
            var notificationKind = subKinds.slice(0, index + 1).join(".");
            
            internalNotifications[notificationKind] && internalNotifications[notificationKind].fastEach(function(callback){
                callback(data);
            });
        });
    }
    
    //***********************************************
    //
    //      Same As
    //
    //***********************************************
    
    function sameAs(a,b){
        var typeofA = typeof a,
            typeofB = typeof b;
            
        if(typeofA !== typeofB){
            return false;
        }
            
        switch (typeof a){
            case 'string': return a === b;
            
            case 'number':
                if(isNaN(a) && isNaN(b)){
                    return true;
                }
                return a === b;
            
            case 'date': return +a === +b;
                        
            default: return false;
        }
    }
    
    //***********************************************
    //
    //      Add Default Style
    //
    //***********************************************
    
    function addDefaultStyle(style){
        defaultViewStyles = defaultViewStyles || (function(){
            defaultViewStyles = document.createElement('style');
            defaultViewStyles.setAttribute("type", "text/css");
            defaultViewStyles.className = "dropdownDefaultStyle";
        
            //Prepend so it can be overriden easily.
            $("head").prepend(defaultViewStyles);
            
            return defaultViewStyles;
        })();

        if (defaultViewStyles.styleSheet) {   // for IE
            defaultViewStyles.styleSheet.cssText = style;
        } else {                // others
            defaultViewStyles.innerHTML += style;
        }
        
    }
    
    //***********************************************
    //
    //      Initialise Action
    //
    //***********************************************
    
    function initialiseViewItem(viewItem, parentViewItem, viewContainer, spec) {
        //if the viewModel is an array, recurse.
        var specCollection;
        
        if (spec === Action){
           specCollection = gaffa.actions;
        }else if(spec === View){
           specCollection = gaffa.views;
        }else if(spec === Behaviour){
           specCollection = gaffa.behaviours;
        }
        
        if(!(viewItem instanceof spec)){
            if (!specCollection[viewItem.type]) {
                console.error("No action is loaded to handle view of type " + viewItem.type);
            }
            
            viewItem = new specCollection[viewItem.type](viewItem);
        }

        for(var key in viewItem.views){
            if(!(viewItem.views[key] instanceof ViewContainer)){
                viewItem.views[key] = new ViewContainer(viewItem.views[key]);
            }
            viewItem.views[key].fastEach(function(view, index, views){
                views[index] = initialiseViewItem(view, viewItem, viewItem.views[key], View);
            });
        }
        
        for(var key in viewItem.actions){
            viewItem.actions[key].fastEach(function(action, index, actions){
                actions[index] = initialiseViewItem(action, viewItem, viewItem.actions[key], Action);
            });
        }
        
        viewItem.viewContainer = viewContainer;
        
        viewItem.parent = parentViewItem;
        
        return viewItem;
    }
    
    //***********************************************
    //
    //      Initialise View
    //
    //***********************************************
    
    function initialiseView(viewModel, parentView, viewContainer) {
        return initialiseViewItem(viewModel, parentView, viewContainer, View);
    }
    
    
    //***********************************************
    //
    //      Add View
    //
    //***********************************************
    
    function addView(viewModel, parentView, parentViewChildArray, index, addInPlace) {
        //if the viewModel is an array, recurse.
        if (viewModel instanceof Array) {
            viewModel.fastEach(function (viewModel, index, viewModels) {
                if(viewModels instanceof ViewContainer){
                    addView(viewModel, parentView, viewModels, index, true);
                }else{
                    addView(viewModel);
                }
            });
            return;
        }
        
        viewModel = initialiseView(viewModel, parentView, parentViewChildArray);
        
        viewModel.parentContainer = parentViewChildArray;
            
        if (parentView && parentViewChildArray) {
            if(index != null){
                if(addInPlace){
                    parentViewChildArray[index] = viewModel;
                }else{
                    parentViewChildArray.splice(index, 0, viewModel);
                }
            }else{
                parentViewChildArray.push(viewModel);
            }
        } else {
            internalViewItems.push(viewModel);
        }
        
        viewModel.render();
        viewModel.bind();
        viewModel.insert(parentViewChildArray);
                
        return viewModel;
    }
    
    
    //***********************************************
    //
    //      Remove Views
    //
    //***********************************************
    
    function removeViews(views){
        if(!views){
            views = internalViewItems;
        }
        !Array.isArray(views) && (views = [views]);
        
        views.fastEach(function(viewModel){
            viewModel.remove();
        });
    }

    //***********************************************
    //
    //      JSON Converter
    //
    //***********************************************

    function jsonConverter(object, exclude, include){
        var tempObject = Array.isArray(object) || object instanceof Array && [] || {},
        excludeProps = ["parent", "viewContainer", "renderedElement"],
        includeProps = ["type"];
                    
        if(exclude){
            excludeProps = excludeProps.concat(exclude);
        }

        if(include){
            includeProps = includeProps.concat(include);
        }

        for(var key in object){
            if(
                object[key] == null ||
                excludeProps.indexOf(key)>=0
            ){
                continue;
            }
            if(
                object.hasOwnProperty(key) ||
                includeProps.indexOf(key)>=0
            ){
                tempObject[key] = object[key];
            }
        }
        
        return tempObject;
    }
    

    //***********************************************
    //
    //      Bind Property
    //
    //***********************************************

    function bindProperty(viewItem) {
    
        // Shortcut for properties that have no binding.
        // This has a significant impact on performance.
        if(this.binding == null){
            if(this.update){
                this.update(viewItem, this.value);
            }
            return;
        }
                
        var property = this,
            updateProperty = function (event) {
                if(event){                    
                    var value,                        
                        scope = { // Scope passed to the property when evaluated.
                            __trackKeys__: property.trackKeys,
                            viewItem: viewItem
                        };

                    
                    if(event === true){ // Initial update.
                        value = gaffa.model.get(property.binding, property, scope);

                    } else if(property.binding){ // Model change update.
                        value = event.getValue(scope);

                    }

                    property.keys = value && value.__gaffaKeys__;
                    property.value = value;
                }
                
                // Call the properties update function, if it has one.
                if(property.update){
                    property.update(viewItem, property.value);
                }
            };
            
        this.parent = viewItem;
        this.binding = new Expression(this.binding);
        gaffa.model.bind(property.binding, updateProperty, property);
        updateProperty(true);
    }
    
    //Public Objects ******************************************************************************
    
    //***********************************************
    //
    //      Property Object
    //
    //***********************************************
    
    function Property(propertyDescription){
        if(typeof propertyDescription === 'function'){
            this.update = propertyDescription;
        }else{
            for(var key in propertyDescription){
                if(propertyDescription.hasOwnProperty(key)){
                    this[key] = propertyDescription[key];
                }
            }            
        }
    }
    Property = createSpec(Property);
    Property.prototype.bind = bindProperty;
    Property.prototype.getPath = function(){
        return getItemPath(this);
    };
    Property.prototype.toJSON = function(){
        var tempObject = jsonConverter(this),
            noTemplate = !tempObject.template,
            noValue = tempObject.value === undefined,
            noBinding = !tempObject.binding || tempObject.binding instanceof gaffa.Expression && !(tempObject.binding.paths && tempObject.binding.paths.length);

        if(noBinding && noTemplate){
            if(noValue){
                return;
            }
            delete tempObject.binding;
        }else{
            delete tempObject.value;
        }
        
        delete tempObject.previousValue;
        
        return tempObject;
    };
    
    //***********************************************
    //
    //      View Container Object
    //
    //***********************************************
    
    function ViewContainer(viewContainerDescription){
        var viewContainer = this;
        viewContainerDescription instanceof Array && viewContainerDescription.fastEach(function(childView){
            viewContainer.push(childView);
        });
        
        this.render = new Property(this.render || {value:true});
        this.render.update = function(viewModel){
            
        };
    }
    ViewContainer = createSpec(ViewContainer, Array);
    ViewContainer.prototype.bind = function(parent){
        this.parent = parent;
        return this;
    };
    ViewContainer.prototype.getPath = function(){
        return getItemPath(this);
    };
    ViewContainer.prototype.add = function(viewModel){

        // If passed an array
        if(Array.isArray(viewModel)){
            var viewContainer = this;
            viewModel.fastEach(function(viewModel){
                viewContainer.add(viewModel);
            });
            return this;
        }
    
        // If this has a parent (it has been bound)
        // call addView, which binds and renderes the
        // inserted views.
        if(this.parent){
            addView(viewModel, this.parent, this);
        }else{
        
        // Otherwise, just push the viewModel into the
        // ViewContainer, to be bound when the parent
        // ViewItem is bound.
            this.push(viewModel);
        }
        return this;
    };
    ViewContainer.prototype.remove = function(viewModel){
        this.fastEach(function(childViewModel, index){
            if(childViewModel === viewModel){
                this.splice(index, 1).remove();
            }
        });
        this.getPath.__pathCache__ = null;
    };
    ViewContainer.prototype.toJSON = function(){
        return jsonConverter(this, ['element']);
    };

    function copyProperties(source, target){
        if(
            !source || typeof source !== 'object' ||
            !target || typeof target !== 'object'
        ){
            return;
        }

        for(var key in source){
            if(source.hasOwnProperty(key)){
                target[key] = source[key];
            }
        }
    }
    
    //***********************************************
    //
    //      ViewItem Object
    //
    //***********************************************
    
    function ViewItem(viewItemDescription){
        
        for(var key in this){
            if(this[key] instanceof Property){
                this[key] = new Property(this[key]);
            }
        }
        
        this.actions = {};
        this.eventHandlers = [];

        for(var key in viewItemDescription){
            if(viewItemDescription.hasOwnProperty(key)){
                var prop = this[key];
                if(prop instanceof Property || prop instanceof ViewContainer){
                    copyProperties(viewItemDescription[key], prop);
                }else{
                    this[key] = viewItemDescription[key];
                }
            }
        }

        this.path = this.path ? new Path(this.path) : new Path('[]');
    }
    ViewItem = createSpec(ViewItem);
    ViewItem.prototype.bind = function(){
        for(var eventKey in this.actions){
            var viewModel = this;
            this.actions[eventKey].fastEach(function(action, index, actions){
                var action = actions[index];
                
                action.bind();
            });
        }
        
        for(var propertyKey in this){
            if(this[propertyKey] instanceof Property){
                this[propertyKey].bind(this);
            }
        }
    };
    ViewItem.prototype.detach = function(){
        $(this.renderedElement).detach();
    };
    ViewItem.prototype.remove = function(){
        if(this.parentContainer){
            this.parentContainer.remove(this);
        }
        
        this.getPath.__pathCache__ = null;
        
        this.renderedElement.parentNode && this.renderedElement.parentNode.removeChild(this.renderedElement);
        
        this.eventHandlers.fastEach(function(handler){
            gedi.debind(handler);
        });
    };
    ViewItem.prototype.getPath = function(){
        return getItemPath(this);
    };
    ViewItem.prototype.toJSON = function(){
        var tempObject = jsonConverter(this),
            noViews = true,
            noActions = true;
            
        if(tempObject.views){
            for(var key in tempObject.views){
                if(tempObject[key] && tempObject[key].template){
                    delete tempObject.views[key];
                    continue;
                }
                
                if(tempObject.views[key].length){
                    noViews = false;
                }
            }
        }
        
        for(var key in tempObject.actions){
            if(tempObject.actions[key].length){
                noActions = false;
            }
        }
        
        if(noViews){
            delete tempObject.views;
        }

        if(noActions){
            delete tempObject.actions;
        }

        if(tempObject.eventHandlers && !tempObject.eventHandlers.length){
            delete tempObject.eventHandlers;
        }
        
        return tempObject;
    };
    
    //***********************************************
    //
    //      View Object
    //
    //***********************************************
    
    function View(viewDescription){}
    View = createSpec(View, ViewItem);
    View.prototype.bind = function(){
        ViewItem.prototype.bind.apply(this, arguments);
        this.forEachChild(function(child){
            child.bind();
        });
        for(var key in this.actions){
            var actions = this.actions[key];
            
            $(this.renderedElement).on(key, function (event) {
                gaffa.actions.trigger(actions);
            });
        }
    };
    View.prototype.render = function(){
        this.renderedElement.viewModel = this;
        this.forEachChild(function(child){
            child.render();
        });
    };    
    View.prototype.insert = function(viewContainer){
        var renderTarget = this.renderTarget || viewContainer && viewContainer.element || gaffa.views.renderTarget || 'body';
        this.insertFunction(this.insertSelector || renderTarget, this.renderedElement);
        typeof this.afterInsert === 'function' && this.afterInsert();
        this.forEachChild(function(child, viewContainer){
            child.insert(viewContainer);
        });
    };    
    View.prototype.classes = new Property(function(viewModel, value){
        var internalClassNames = viewModel.renderedElement.internalClassNames = viewModel.renderedElement.internalClassNames || $(viewModel.renderedElement).attr("class") || "";
            
        $(viewModel.renderedElement).attr("class", internalClassNames + " " + (value || ""));
    });
    View.prototype.forEachChild = function(callback){
        for(var key in this.views){
            var parentView = this;
            this.views[key].fastEach(function(view){
                callback(view, parentView.views[key]);
            });
        }
    };
    View.prototype.visible = new Property(function(viewModel, value) {
        if (value === false) {
            $(viewModel.renderedElement).css("display", "none");
        } else {
            $(viewModel.renderedElement).css("display", "");
        }
    });
    View.prototype.insertFunction = insertFunction;
    
    
    //***********************************************
    //
    //      Container View Object
    //
    //***********************************************
    
    function ContainerView(viewDescription){
        this.views = this.views || {};
        this.views.content = new ViewContainer(this.views.content);
    }
    ContainerView = createSpec(ContainerView, View);
    ContainerView.prototype.bind = function(){
        for(var key in this.views){
            var viewContainer = this.views[key];
            
            if(viewContainer instanceof ViewContainer){
                viewContainer.bind(this);
            }
        };
        View.prototype.bind.apply(this, arguments);
    };
    
    //***********************************************
    //
    //      Action Object
    //
    //***********************************************
    
    function Action(actionDescription){
    }
    Action = createSpec(Action, ViewItem);
    Action.prototype.bind = function(){
        ViewItem.prototype.bind.apply(this, arguments);
    };
    
    //***********************************************
    //
    //      Behaviour Object
    //
    //***********************************************
    
    function Behaviour(behaviourDescription){}
    Behaviour = createSpec(Behaviour, ViewItem);
    Behaviour.prototype.bind = function(){   
        ViewItem.prototype.bind.apply(this, arguments);  
        
        this.path = Path.parse(this.path);
    };
    Behaviour.prototype.remove = function(){
        var thisBehaviour = this;
        internalBehaviours.fastEach(function(behaviour, index){
            if(behaviour === thisBehaviour){
                internalBehaviours.splice(index, 1);
            }
        });
        ViewItem.prototype.remove.call(this);
    };
    Behaviour.prototype.toJSON = function(){
        return jsonConverter(this);
    };
    
    //***********************************************
    //
    //      Page Load Behaviour
    //
    //*********************************************** 
    
    function PageLoadBehaviour(){}
    PageLoadBehaviour = createSpec(PageLoadBehaviour, Behaviour);
    PageLoadBehaviour.prototype.bind = function(){
        Behaviour.prototype.bind.apply(this, arguments);
        
        gaffa.actions.trigger(this.actions.load, this);        
    };
    
    
    //***********************************************
    //
    //      Model Change Behaviour
    //
    //*********************************************** 
    
    function ModelChangeBehaviour(){}
    ModelChangeBehaviour = createSpec(ModelChangeBehaviour, Behaviour);
    ModelChangeBehaviour.prototype.bind = function(){
        Behaviour.prototype.bind.apply(this, arguments);
        
        var behaviour = this;
        
        function executeBehaviour(behaviour, context){
            var currentValue = JSON.stringify(gedi.get(behaviour.path));
                if(currentValue !== behaviour.previousValue){
                    behaviour.previousValue = currentValue;
                    gaffa.actions.trigger(behaviour.actions.change, behaviour, context);
                }
        }
        
        gaffa.model.bind(behaviour.watch || '[]', function (modelChangeEvent){
            var context;

            if(behaviour.context){
                context = Path.parse(behaviour.context);
                if(context.last() === gaffa.pathWildcard){
                    context.pop();
                    if(modelChangeEvent.target.toRawString().indexOf(context.toRawString()) === 0){
                        context.push(modelChangeEvent.target[context.length]);
                    }
                }else{
                    context = Path.parse(behaviour.path);
                }
            }
            var throttleTime = behaviour.throttle;
            if(!isNaN(throttleTime)){
                var now = new Date();
                if(!behaviour.lastTrigger || now - behaviour.lastTrigger > throttleTime){
                    behaviour.lastTrigger = now;
                    executeBehaviour(behaviour, context);
                }else{
                    clearTimeout(behaviour.timeout);
                    behaviour.timeout = setTimeout(function(){
                            behaviour.lastTrigger = now;
                            executeBehaviour(behaviour, context);
                        },
                        throttleTime - (now - behaviour.lastTrigger)
                    );
                }
            }else{
                executeBehaviour(behaviour, context);
            }
        }, this);
    };
    
    
    //***********************************************
    //
    //      Interval Behaviour
    //
    //***********************************************                 
    
    function IntervalBehaviour(){}
    IntervalBehaviour = createSpec(IntervalBehaviour, Behaviour);
    IntervalBehaviour.prototype.bind = function(){  
        Behaviour.prototype.bind.apply(this, arguments);
        var behaviour = this,
            loop = true,
            currentTimeout,
            intervalLoop = function(){
                
                behaviour.killInterval = function(){
                    loop = false;
                    clearTimeout(currentTimeout);
                };
                
                if(!loop){
                    return;
                }
                
                currentTimeout = setTimeout(function(){
                    behaviour.actions.tick && gaffa.actions.trigger(behaviour.actions.tick, behaviour);
                    intervalLoop();
                },behaviour.time || 5000);//If you forget to set the interval, we will be nice and give you 5 seconds of debug time by default, rather than 0ms looping you to death.
            };

        intervalLoop(); 
    };
    IntervalBehaviour.prototype.remove = function(){
        this.killInterval && this.killInterval();
        Behaviour.prototype.remove.call(this);
    }
    
    
    //***********************************************
    //
    //      add Behaviour
    //
    //*********************************************** 
    
    function addBehaviour(behaviours) {
        //if the views isnt an array, make it one.
        if (behaviours && !behaviours.length) {
            behaviours = [behaviours];
        }

        behaviours.fastEach(function (behaviour, index, behaviours) {
            behaviour = initialiseViewItem(behaviour, null, null, Behaviour);  
            
            behaviour.bind();
            
            internalBehaviours.push(behaviour);
        });
    }
    
    
    //***********************************************
    //
    //      Remove Behaviour
    //
    //***********************************************
    
    function removeBehaviour(behaviour){
        if(!behaviour){
            for(var key in internalBehaviours){
                internalBehaviours[key].remove();
            }
            return;
        }
        
        if(behaviour instanceof Behaviour){
            behaviour.remove();
        }else if(typeof behaviour === 'string'){
            internalBehaviours[behaviour].remove();
        }
    }
    

    //***********************************************
    //
    //      Gaffa object.
    //
    //***********************************************

    extend(gaffa, {
        addDefaultStyle: addDefaultStyle,
        createSpec: createSpec,
        jsonConverter: jsonConverter,
        Path: gedi.Path,
        Expression: gedi.Expression,
        ViewItem: ViewItem,
        View: View,
        ContainerView: ContainerView,
        Action: Action,
        Behaviour: Behaviour,
        Property: Property,
        ViewContainer: ViewContainer,
        model: {
            get:function(path, parent, scope) {
                if(!(parent instanceof ViewItem || parent instanceof Property)){
                    scope = parent;
                    parent = undefined;
                }

                var parentPath;
                if(Path.mightParse(path) && parent && parent.getPath){
                    parentPath = parent.getPath();
                }
                
                return gedi.get(path, parentPath, scope);
            },
            set:function(path, value, parent, dirty) {
                var parentPath;
                if(Path.mightParse(path) && parent && parent.getPath){
                    parentPath = parent.getPath();
                }
                
                gedi.set(path, value, parentPath, dirty);
            },
            remove: function(path, parent) {
                var parentPath;
                if(Path.mightParse(path) && parent && parent.getPath){
                    parentPath = parent.getPath();
                }
                
                gedi.remove(path, parentPath);
            },
            bind: function(path, callback, parent) {
                var parentPath;
                if(Path.mightParse(path) && parent && parent.getPath){
                    parentPath = parent.getPath();
                }
                
                // Add the callback to the list of handlers associated with the viewItem
                if(parent instanceof ViewItem && !(callback in parent.eventHandlers)){
                    parent.eventHandlers.push(callback);
                }
                
                gedi.bind(path, function(event){
                    return callback(event);
                }, parentPath);
            }
        },
        views: {
            insertTarget: null,
            
            //Add a view or viewModels to another view, or the root list of viewModels if a parent isnt passed.
            //Set up the viewModels bindings as they are added.
            add: addView,
            
            remove: removeViews
        },

        actions: {
            add: function(key, actions){
                if(!Array.isArray(actions)){
                    actions = [actions];
                }
                
                internalActions[key] = actions;
            },
            trigger: function (actions, parent) {
                if(typeof actions === "string"){
                    actions = internalActions[actions];
                }
                actions instanceof Array && actions.fastEach(triggerAction);
            }
        },

        behaviours: {
            add: addBehaviour,
            
            pageLoad: PageLoadBehaviour,
            
            modelChange: ModelChangeBehaviour,
                            
            interval: IntervalBehaviour,
            
            remove: removeBehaviour
        },

        utils: {
            //See if a property exists on an object without doing if(obj && obj.prop && obj.prop.prop) etc...
            getProp: function (object, propertiesString) {
                var properties = propertiesString.split(gaffa.pathSeparator).reverse();
                while (properties.length) {
                    var nextProp = properties.pop();
                    if (object[nextProp] !== undefined && object[nextProp] !== null) {
                        object = object[nextProp];
                    } else {
                        return;
                    }
                }
                return object;
            },
            //See if a property exists on an object without doing if(obj && obj.prop && obj.prop.prop) etc...
            propExists: function (object, propertiesString) {
                var properties = propertiesString.split(".").reverse();
                while (properties.length) {
                    var nextProp = properties.pop();
                    if (object[nextProp] !== undefined && object[nextProp] !== null) {
                        object = object[nextProp];
                    } else {
                        return false;
                    }
                }
                return true;
            },
            deDom: deDom
        },

        propertyUpdaters: {

            string: function (callback) {
                if (typeof callback !== "function") {
                    //passed a property object, doing a set.
                    var property = arguments[1],
                        viewModel = callback,
                        value = arguments[2];
                    
                    gaffa.model.set(property.binding, value, viewModel);
                } else {
                    return function (viewModel, value) {
                        var property = this,
                            element = viewModel.renderedElement,
                            convertDateToString = function (date){
                                if(date && date instanceof Date && typeof gaffa.dateFormatter === "function"){
                                    return gaffa.dateFormatter(date);
                                }else{
                                    return date;
                                }
                            };
                            
                        if (value !==  property.previousValue) {
                            if(value == null){
                                property.value = "";
                            }
                            property.value = convertDateToString(property.value).toString();
                            if (element) {
                                callback(viewModel, property.value);
                            }
                        }
                        property.previousValue = property.value;
                    };
                }
            },
            
            number: function (callback) {
                if (typeof callback !== "function") {
                    //passed a property object, doing a set.
                    var property = this,
                        viewModel = property.parent,
                        number = callback;

                    gaffa.model.set(property.binding, number, viewModel);
                    
                } else {
                    return function (viewModel, value) {
                        var property = this,
                            element = viewModel.renderedElement;
                        
                        if (property.previousValue !== value) {
                            property.previousValue = value;
                            if (element) {
                                callback(viewModel, value);
                            }
                        }
                    };
                }
            },
            
            collection: function (viewsName, insert, remove, empty) {
                var propertyName;
                return function (viewModel, value) {
                    var property = this,
                        sort = property.sort,
                        valueLength = 0,
                        childViews = viewModel.views[viewsName],
                        valueKeys = property.keys,
                        calculateValueLength = function(){
                            if(Array.isArray(value)){
                                return value.length;
                            }else if(typeof value === "object"){
                                return Object.keys(value).length;
                            }
                        };
                        
                    // This feels bad..
                    if(!propertyName){
                        for(var key in viewModel){
                            if(viewModel[key] === property){
                                propertyName = key;
                                return;
                            }
                        }
                    }
                        
                    property.addedViews = property.addedViews || [];
                        
                    if (value && typeof value === "object"){

                        var element = viewModel.renderedElement;
                        if (element && property.template) {
                            var newView,
                                isEmpty = true;
                            
                            //Remove any child nodes who no longer exist in the data
                            for(var i = 0; i < childViews.length; i++){
                                var childView = childViews[i],
                                    existingKey = childView.key;
                                    
                                if(
                                    (
                                        (valueKeys && !valueKeys.indexOf(existingKey)>=0) ||
                                        !value[childView.key]
                                    ) &&
                                    childView.parentProperty === propertyName
                                ){
                                    childViews.splice(i, 1);
                                    i--;
                                    remove(viewModel, value, childView);
                                }
                            }
                            
                            //Add items which do not exist in the dom
                            for (var key in value) {
                                if(Array.isArray(value) && isNaN(key)){
                                    continue;
                                }
                                
                                isEmpty = false;
                                
                                var existingChildView = false;
                                for(var i = 0; i < childViews.length; i++){
                                    var child = childViews[i],
                                        valueKey = key;
                                        
                                    if(valueKeys){
                                        valueKey = valueKeys[key];
                                    }
                                        
                                    if(child.key === valueKey){
                                        existingChildView = child;
                                    }
                                }
                                
                                if (!existingChildView) {
                                    var newViewKey = key;
                                    if(valueKeys){
                                        newViewKey = valueKeys[key];
                                    }
                                    newView = {key: newViewKey, parentProperty: propertyName};
                                    insert(viewModel, value, newView);
                                }
                            }
                            
                            empty(viewModel, isEmpty);
                                
                            if(sort && !isEmpty){
                                                            
                                childViews.sort(function(a,b){
                                
                                    //Im hyjacking the fact that sort hits every childView
                                    //to reset the isRendered flag. I could run a loop before this that
                                    //reset it but this cuts down on a loop...
                                    b.isRendered = false;
                                    
                                    return gaffa.utils.getProp(value[a.key], sort) - gaffa.utils.getProp(value[b.key], sort);
                                });
                                
                                window.gaffa.views.render(childViews, childViews.element);
                            }
                        }
                    }else{
                        for(var i = 0; i < childViews.length; i++){
                            if(property.addedViews.indexOf(childView) >=0){
                                childViews.splice(index, 1);
                                property.addedViews.splice(property.addedViews.indexOf(childView), 1);
                                index--;
                                remove(viewModel, value, childView);                            
                            }
                        }
                    }
                };
            },
            
            group: function (viewsName, insert, remove, empty) {
                return function (viewModel, value) {
                    var property = this,
                        childViews = viewModel.views[viewsName],
                        previousGroups = property.previousGroups,
                        newView,
                        isEmpty;
                    
                    if (value && typeof value === "object"){
                        
                        viewModel.distinctGroups = getDistinctGroups(property.value, property.expression);

                        if(previousGroups){
                            if(previousGroups.length === viewModel.distinctGroups.length){
                                return;
                            }
                            var same = true;
                            previousGroups.fastEach(function(group, index){
                                if(group !== viewModel.distinctGroups[group]){
                                    same = false;
                                }
                            });
                            if(same){
                                return;
                            }
                        }

                        property.previousGroups = viewModel.distinctGroups;

                        
                        for(var i = 0; i < childViews.length; i++){
                            var childView = childViews[i];
                            if(viewModel.distinctGroups.indexOf(childView.group)<0){
                                childViews.splice(i, 1);
                                i--;
                                remove(viewModel, value, childView);
                            }
                        }
                        
                        viewModel.distinctGroups.fastEach(function(group){
                            var exists = false;
                            childViews.fastEach(function(child){
                                if(child.group === group){
                                    exists = true;
                                }
                            });
                            
                            if (!exists) {
                                newView = {group: group};
                                insert(viewModel, value, newView);
                            }
                        });
                                                    
                        isEmpty = !childViews.length;
                                                    
                        empty(viewModel, isEmpty);
                    }else{
                        childViews.fastEach(function(childView, index){
                            childViews.splice(index, 1);
                            remove(viewModel, property.value, childView);
                        });
                    }
                };
            },

            bool: function (callback) {
                if (typeof callback !== "function") {
                    //passed a property object, doing a set.
                    var property = arguments[1],
                        viewModel = callback,
                        value = arguments[2];

                    gaffa.model.set(property.binding, value, viewModel);
                    
                } else {
                    return function (viewModel, value) {
                        var property = this;
                            
                        if (property.previousValue !== value) {
                            property.previousValue = value;
                            callback(viewModel, property.value);
                        }
                    };
                }
            },
            
            // ToDo: I dont like this...
            object: function (callback) {
                return function (viewModel, value) {
                    var property = this;
                    callback(viewModel, property.value);
                };
            }
        },

        navigate: navigate,
        
        notifications:{  
            add: addNotification,
            notify: notify
        },
        
        load: function(app, pushPageState){
                    
            var title;
                    
            if(app !== undefined && app !== null && app.title){
                title = app.title;
            }
            if(pushPageState){
                // ToDo: Push state no worksies in exploder.
                history.pushState(app, title, document.location);
            }
            load(app);
        },
        
        //If you want to load the values in query strings into the pages model.
        queryStringToModel: queryStringToModel,
        
        //This is here so i can remove it later and replace with a better verson.
        extend: extend,
        
        clone: function(value){
            if(value != null && typeof value === "object"){
                if(Array.isArray(value)){
                    return value.slice();
                }else if (value instanceof Date) {
                    return new Date(value);
                }else{
                    return $.extend(true, {}, value);
                }
            }
            return value;
        }

    });
})();
