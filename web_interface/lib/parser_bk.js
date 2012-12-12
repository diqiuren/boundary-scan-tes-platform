var state 	= ["RESET","IDLE","DRSELECT","DRCAPTURE","DRSHIFT","DREXIT1","DRPAUSE","DREXIT2","DRUPDATE","IRSELECT","IRCAPTURE","IRSHIFT","IREXIT1","IRPAUSE","IREXIT2","IRUPDATE"];
var len 	= [""];	//from 0 to 65535
var clocks 	= len;
var tap		= ["1","2","BOTH"];
var label	= len;
var pin		= ["0","1"];
var tdi 	= ["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F"];
var tdo 	= tdi;
var mask 	= tdi;
var smask 	= tdi;

var functions = ["STATE","SDR","SIR","ENDDR","ENDIR","RUNTEST","SELTAP","JMP","JMPE","RSTE","JMPI","SETI","RSTI"];
var functionsStates = [null,4,11,null,null,11,null,null,null,null,null,null,null];
//var upCodes = ["0x01","0x02","0x03","0x04","0x05","0x06","0x07","0x08","0x09","0x0A","0x0B","0x0C","0x0D"];	//not used for now... maybe never :P
/**
 * Number of arguments of each function
 */
var maxArgs = [1,5,5,1,1,1,1,1,1,0,2,1,1,0];
var minArgs = [1,2,2,1,1,1,1,1,1,0,2,1,1,0];
var scanArgs = ["TDI", "TDO", "MASK", "SMASK"];
var subFunctionsArgs = [state,[label,tdi,tdo,mask,smask],[label,tdi,tdo,mask,smask],state,state,clocks,tap,label,label,"0",[pin,label],pin,pin, "0"];

/**
 * TAP State Machine Controll
 */
var currentState = 0;
var nextState = -1;
var k = -1;
var dNeigborStates = [];		//states that can switch to desired state
var nextStates = [[1, 0], [1, 2], [3, 9], [4, 5], [4, 5], [6, 8], [6, 7], [4, 8], [1, 2], [10, 0], [11, 12], [11, 12], [13, 15], [13, 14], [11, 15], [1, 2]];
var tmsPath = [];

/**
 * Eliminate duplicated elements of an array
 */
function eliminateDuplicates(array) {
var i,
  len=array.length,
  out=[],
  obj={};

 for (i=0;i<len;i++) {
 obj[array[i]]=0;
 }
 for (i in obj) {
 out.push(i);
 }
 return out;
}


/**
 * Find path from a state to another
 */
 function findPath(dest) {
	var sNeigborStates = nextStates[currentState];		//states to witch current state can switch
	k++;
	for(var i = 0; i < nextStates.length; i++) {
		var tms = nextStates[i].indexOf(dest);
		if(tms >= 0) {
			dNeigborStates[dNeigborStates.length] = [i,tms];
			if(i == sNeigborStates[0]) {
				dNeigborStates[dNeigborStates.length] = " ";
				dNeigborStates[dNeigborStates.length] = [currentState,nextStates[currentState].indexOf(sNeigborStates[0])];
				processPath();
				return 0;
			}
			if(i == sNeigborStates[1]){
				dNeigborStates[dNeigborStates.length] = " ";
				dNeigborStates[dNeigborStates.length] = [currentState,nextStates[currentState].indexOf(sNeigborStates[1])];
				processPath();
				return 0;
			}

		}
	}
	dNeigborStates[dNeigborStates.length] = " ";
	if(dNeigborStates[k] != " ") {
		findPath(dNeigborStates[k][0]);
	}
	else {
		k++;
		findPath(dNeigborStates[k][0]);
	}
 }

/**
 * Process path and convert on tms and tck impulses
 */
 function processPath () {
	var tms = [];
 	var path = [];
	var j = 0;
	var next = [];
	alert("dNeigborStates: "+dNeigborStates);
	next = nextStates[dNeigborStates[dNeigborStates.length-1][0]][dNeigborStates[dNeigborStates.length-1][1]];
	path[path.length] =dNeigborStates[dNeigborStates.length-1];
	tms[tms.length] = dNeigborStates[dNeigborStates.length-1][1];
	for (var i=dNeigborStates.length-2; i>-1; i--) {
		if(dNeigborStates[i][0] == next) {
			next = nextStates[dNeigborStates[i][0]][dNeigborStates[i][1]];
			path[path.length] = dNeigborStates[i];
			tms[tms.length] = dNeigborStates[i][1];
		}

	}
	dNeigborStates = [];
	k = 0;
	alert("Path: "+path);
	alert("TMS: "+tms);
	tmsPath = tms;
 }

/**
 * Check if string is a number
 */
function isNumeric(input) {
    return ((input - 0) == input && input.length > 0);
}


/**
 * Convert all characters of a line to upper case, remove inconvenient spaces and split parameters
 */
function polishLine (line) {
	_line = line.replace(/\s+/g, ' ');			//remove extra spaces
	//remove spaces between parentheses
	_line = _line.replace(/\s\(/g,'(');
	_line = _line.replace(/\(\s/g,'(');
	_line = _line.replace(/\s\)/g,')');

	var polishedLine = _line.split(' ');
	var len = polishedLine.length;
	if(polishedLine[len-1] == "" && len > 1) {
		polishedLine.splice(len-1,1); //remove last sapce of a given line
	}
	if(polishedLine[0] == "" && polishedLine.length > 1) {
		polishedLine.splice(0,1); //remove initial space if any
	}
	for(var i=0; i<polishedLine.length;i++) {
		polishedLine[i] = polishedLine[i].toUpperCase();
	}
	return polishedLine;
}

/**
 * Convert an array of parameters and returns an error if there are brakets missing
 */
function polishParams (params) {
	var polishedParams = [];
	polishedParams[0] = params[0];
	polishedParams[1] = params[1];
	for(var i=2; i<params.length; i++) {		//only needed for SDR or SIR
		if(params[i].indexOf('(') < 0)
			return -1;
		var polishedTemp = params[i].split('(');
		if(polishedTemp[1].indexOf(')') < 0)
			return -1;
		polishedTemp[1] = polishedTemp[1].replace(')','');
		polishedParams[polishedParams.length] = polishedTemp[0];
		polishedParams[polishedParams.length] = polishedTemp[1];
	}
	return polishedParams;
}

/**
 * Check if the function parameters are correct
 */
function checkParams (params, index) {
	var polishedParams = polishParams (params);
	if(polishedParams < 0)
		return -1;
	var lastParam = "";
	if(index == 1 || index == 2) {		//SDR or SIR
		if(isNumeric(polishedParams[1]) == false || polishedParams[1] > 65535 || polishedParams.indexOf("TDI") < 0)
			return -1;
		for(var i=2; i<polishedParams.length; i+=2) {
			if(polishedParams[i] == lastParam)
				return -1				//repeted parameter
			lastParam = polishedParams[i];
			if(scanArgs.indexOf(polishedParams[i]) < 0)
				return -1;
			if(polishedParams[i+1].length > polishedParams[1]/4)
				return -1;				//too many bits
			for(var j = 0; j < polishedParams[i+1].length; j++) {
				if(tdi.indexOf(polishedParams[i+1].charAt(j)) < 0)
					return -1;
			}
		}
		return 1;
	}
	if(index == 0){						//STATE
		if(state.indexOf(params[1]) < 0)
			return -1;
		else
			return 1;
	}
	if(index == 5){						//RUNTEST
		if(isNumeric(params[1]) == false)
			return -1;
		else
			return 1;
	}
	if(index == 6){						//SELTAP
		if(isNumeric(params[1]) == false)
			return -1;
		else if(params[1]-0 > 2 || params[1]-0 < 0)
			return -1;
		else
			return 1;
	}
	return -4;							//function not implemented
}

/**
 * Check sintax of a line
 */
function checkSyntax(line) {
	var params = polishLine (line);
	var len = params.length-1;
	var index = functions.indexOf(params[0].toUpperCase());	//get index of the matching keyword on the keywords array
	var subFuncIndex;

	if(index < 0 && params[0] != "")
		return -1;					//keyword not foud!
	else if(len-maxArgs[index] > 0)
		return -2;					//too many arguments
	else if(len-minArgs[index] < 0)
		return -3;					//few arguments
	else {
		return checkParams(params, index);
	}
}


/**
 * Create url asking for a fake page with arguments
 */
function makeUrl(text) {
	var lines = text.split('\n');
	var params = [];
	var url = "";
	var tcks = 0;
	var tms = [];
	var sintax = 0;
	var polishedParams = [];
	var _nextState;
	for(var i = 0; i<lines.length; i++) {
		sintax = checkSyntax(lines[i]);
		if(sintax == -4) {
			alert("Sorry, there is some function that isn't implemented iet :(");
			return -1;
		}
		if(sintax < 0) {
			alert("Please loock closer to your code.\nYou still have errors!");
			return -1;
		}
		params = polishLine(lines[i]);
		switch(params[0]) {
			case "STATE":
				nextState = state.indexOf(params[1]);
				break;
			case "SDR":
				polishedParams = polishParams(params);

				if(currentState != 4) {
					findPath(4);														//find tms impulses to go to state 4 (Shift-DR)
					alert("TMS: "+tmsPath);
					url = ip+"/fake_page.fk?"+"tms="+tmsPath+"&TDI="+polishedParams[polishedParams.indexOf("TDI")+1]+"&tck="+polishedParams[1];		//Create generic URL
					switch(polishedParams.length) {
						case 6:
							url = url+"&TDO="+polishedParams[polishedParams.indexOf("TDO")+1];
							break;
						case 8:
							url = url+"&TDO="+polishedParams[polishedParams.indexOf("TDO")+1]+"&MASK="+polishedParams[polishedParams.indexOf("MASK")+1];
							break;
						case 10:
							url = url+"&TDO="+polishedParams[polishedParams.indexOf("TDO")+1]+"&MASK="+polishedParams[polishedParams.indexOf("MASK")+1]+"&SMASK="+polishedParams[polishedParams.indexOf("SMASK")+1];
							break;
					}
					alert(url);
					sendData(url);														//send instruction to uC
					currentState = nextState											//updates current state
				}


				tcks = polishedParams[1];


				break;
			case "SIR":
				polishedParams = polishParams(params[i]);
				nextState =	11;
				break;
			case "RUNTEST":
				nextState = 0;
				break;
		}

		url = "fake_page.fk?"+"qqcoisa";
	}
	return 0;
}

/**
 * Send data to micro using HTTP GET command
 */
function sendData(url) {
	if (window.XMLHttpRequest) {// code for IE7+, Firefox, Chrome, Opera, Safari
		xmlhttp=new XMLHttpRequest();
	}
	else {// code for IE6, IE5
		xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
	}

	xmlhttp.open("GET",url,true);
	xmlhttp.send(null);
}

//for source state=0 and final state = 6
//1st call of function findPath():
	//dNeigborStates: 5,0,6,0, ,3,1,4,1, ,5,0,6,0, ,2,0, ,3,0,4,0,7,0, ,3,1,4,1, ,5,0,6,0, ,1,1, ,0,0
//following calls of function findPath():
	//dNeigborStates: 5,0,6,0, ,5,0,6,0, ,3,1,4,1, ,5,0,6,0, ,2,0, ,3,0,4,0,7,0, ,3,1,4,1, ,5,0,6,0, ,1,1, ,0,0

//Na placa definir o MIME type para os ficheiros *.js para application/x-javascript e para os *.css
