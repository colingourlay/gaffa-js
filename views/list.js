//	Properties:
//		styles: container | container-fluid | row | row-fluid | span* | offset*
(function(undefined) {
    var viewType = "list",
        defaults = {
            viewContainers:{
                list: []
            },
            properties: {
                visible: {},                
                list: {}
            }
        };
    
	window.gaffa.views = window.gaffa.views || {};
	window.gaffa.views[viewType] = window.gaffa.views[viewType] || newView();
    
	function createElement(viewModel) {
		var classes = viewType;
		if (
            //ToDo: make a function that does this automaticaly
            viewModel.properties
            && viewModel.properties.classes
            && viewModel.properties.classes.value
        ) {
		    classes += " " + viewModel.properties.classes.value;
		}
        
        var renderedElement = $(document.createElement('div')).addClass(classes);
        
        viewModel.viewContainers.list.element = renderedElement;
        
		return renderedElement;
	}

	function newView() {
		
		function view() {
		}	
		
		view.prototype = {
			update: {
                visible: function(viewModel, value, firstRun) {
                    if(viewModel.properties.visible.value !== value || firstRun){
                        viewModel.properties.visible.value = value;
                        var element = viewModel.renderedElement;
                        if(element){
                            if(value !== false){
                                element.show();
                            }else{
                                element.hide();
                            }
                        }
                    }                    
                },                
                list: function(viewModel, value, firstRun) {
                    if(value && value.length && (viewModel.properties.list.length !== value.length || firstRun)){
                        viewModel.properties.list.value = value;
                        var element = viewModel.renderedElement;
                        if(element && viewModel.properties.list.template){
                            var listViews = viewModel.viewContainers.list;
                            while(value.length < listViews.length){
                                viewModel.viewContainers.list.pop().renderedElement.remove();
                            }
                            while(value.length > listViews.length){
                                window.gaffa.views.add($.extend(true, {}, viewModel.properties.list.template), viewModel, listViews, listViews.length);
                            }
                            window.gaffa.views.render(viewModel.viewContainers.list, viewModel.viewContainers.list.element);
                        }
                    }                    
                }
			}
		};
        
        $.extend(true, view.prototype, window.gaffa.views.base(viewType, createElement, defaults));
                
		return new view();
	}
})();