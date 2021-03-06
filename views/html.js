(function(undefined) {
    var viewType = "html",
		cachedElement;
        
    function Html(){}
    Html = gaffa.createSpec(Html, gaffa.View);
    Html.prototype.type = viewType;
    
    Html.prototype.render = function(){
        var classes = viewType;
        
        var renderedElement = document.createElement('span');
        
        this.renderedElement = renderedElement;
        
        this.__super__.render.apply(this, arguments);
    };
    
    Html.prototype.html = new gaffa.Property(window.gaffa.propertyUpdaters.string(function(viewModel, value){
        if(value !== null && value !== undefined){
            viewModel.renderedElement.innerHTML = value;
        }else{
            viewModel.renderedElement.innerHTML = "";
        }
    }));
    
    gaffa.views[viewType] = Html;
    
})();