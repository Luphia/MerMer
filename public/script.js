let $id = (id) => {
	return document.getElementById(id);
};
let $class = (classname) => {
	return document.getElementsByClassName(classname)[0];
};
let $tag = (tag) => {
	return document.getElementsByTagName(tag)[0];
};
let addClass = (el, classname) => {
	let classes = el.className.split(" ");
	if(classes.indexOf(classname) == -1) {
		classes.push(classname);
		el.className = classes.join(" ");
	}
};
let removeClass = (el, classname) => {
	let classes = el.className.split(" ");
	let i;
	if((i = classes.indexOf(classname)) > -1) {
		classes.splice(i, 1);
		el.className = classes.join(" ");
	}
};

let appendFile = (el, file) => {
	let div = document.createElement("div");
	div.innerText = [file.name, file.size].join(": ");
	el.append(div);
}
let body = $tag("body");
let appendHash = (data) => {
	let div = document.createElement("div");
	div.innerText = data.hash;
	body.append(div);
};

let rw = new Worker('./rusha.min.js');
rw.onmessage = (e) => {
	if (e.data.error) {
		console.log(e.data.error);
	}
	else {
		appendHash(e.data)
	}
};
let sha1Worker = (data) => {
	rw.postMessage({ id: 0, data: data });
};
let readFile = (file) => {
	let fr = new FileReader(),
	chunkSize = 2097152,
	chunks = Math.ceil(file.size / chunkSize),
	chunk = 0;

	let loadNext = () => {
		var start, end,
		blobSlice = File.prototype.mozSlice || File.prototype.webkitSlice || File.prototype.slice;

		start = chunk * chunkSize;
		end = start + chunkSize >= file.size ? file.size : start + chunkSize;

		fr.onload = () => {   
			sha1Worker(fr.result);
			if (++chunk < chunks) {
				loadNext();
			}
		};
		fr.readAsBinaryString(blobSlice.call(file, start, end));
	}

	loadNext();
};

let notification = ({msg, duration}) => {
	let container = $tag("body");
	let msgTag = document.createElement("div");
	msgTag.innerText = msg;
};

let area = $id('uploader');
document.addEventListener('dragover', (ev) => {
	event.preventDefault();
	let target = ev.target;
	addClass(target, "onfiledrop");
	return false
}, false);
document.addEventListener('dragleave', (ev) => {
	event.preventDefault();
	let target = ev.target;
	removeClass(target, "onfiledrop");
	return false
}, false);
document.addEventListener('drop', (ev) => {
	event.preventDefault();
	let target = ev.target;
	let files = ev.dataTransfer.files
	let container = $id("container");
	removeClass(target, "onfiledrop");
	for(var k in files) {
		if(typeof(files[k]) == "object") {
			readFile(files[k]);
			appendFile(container, files[k]);
		}
	}
}, false);
