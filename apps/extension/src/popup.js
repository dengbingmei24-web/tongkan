const status = document.querySelector("#status");
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

if (tab?.url?.includes("bilibili.com/video/")) {
  status.textContent = "当前是 B站视频页，可以接收房间控制。";
} else if (tab?.url?.includes("/room/")) {
  status.textContent = "当前房间页已打开；请另开一个 B站视频标签页。";
} else {
  status.textContent = "当前页不是房间或 B站视频页。";
}

document.querySelector("#open-room").addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:5173" });
});
