(() => {
	let ecfs = class ecfs {
		send ({file, url}) {

		}
	};

	if (typeof module !== 'undefined') {
		module.exports = ecfs;
	} else if (
		typeof window !== 'undefined') {
		window.ecfs = ecfs;
	}
} ());