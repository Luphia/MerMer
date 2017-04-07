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

let body = $tag("body");
let appendText = (data) => {
	let div = document.createElement("div");
	div.innerText = data;
	body.append(div);
};
let appendFile = (el, file) => {
	appendText([file.name, file.size].join(": "));
}
let appendHash = (data) => {
	appendText(data.hash);
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
	chunkSize = 2097152,
	chunks = Math.ceil(file.size / chunkSize),
	chunk = 0;

	new Array(chunks).fill(0).map((v, i) => { return i; }).reduce((pre, curr) => {
		return pre.then(() => {
			let blobSlice = File.prototype.mozSlice || File.prototype.webkitSlice || File.prototype.slice;
			let start, end, shard, method, path, data, responseType, options, request;
			start = curr * chunkSize;
			end = start + chunkSize >= file.size ? file.size : start + chunkSize;
			shard = blobSlice.call(file, start, end);
			method = "POST";
			path = '/file/';
			responseType = "json";
			data = new FormData();
			data.append("shard", shard);
			data.append("total", chunks);
			data.append("index", curr);
			data.append("fileSize", file.size);
			data.append("chunkSize", chunkSize);
			options = {method, data, path, responseType}

			request = new XMLHttpRequest();
			if(responseType) { request.responseType = responseType; }
			return new Promise((resolve, reject) => {
				request.onload = function() {
					resolve(request.response);
					appendText("Upload: " + curr + " / " + chunks);
				};
				request.onreadystatechange = function (oEvent) {
					if (request.readyState === 4) {
						if(request.status != 200) {
							reject(new Error(request.statusText));
							console.log(request.statusText);
						}
					}
				};
				request.open(method, path);
				request.send(data);
			});
		});
	}, Promise.resolve());
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
