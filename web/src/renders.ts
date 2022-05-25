
import { localUser, peers, users } from "./main";

const socketStatus = document.querySelector<HTMLDivElement>("#socket-status")!;
const userList = document.querySelector<HTMLUListElement>("#user-list")!;
const videoContainer = document.querySelector("#video-container")!;

export const renderStatus = (status: string, error?: Error) => {
  socketStatus.innerHTML = `${status} ${error?.message ?? ""}`;
};

export const renderVideo = (stream: MediaStream, userId: string, fromCode: string) => {
  console.log('rendering video', stream, userId, 'from function' ,fromCode);

  const video = document.getElementById(userId) as HTMLVideoElement | null;

  if (video) {
    video.srcObject = stream;
  } else {
    const video = document.createElement("video");
    video.id = userId;
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    videoContainer.appendChild(video);
  }
};

export const renderUsers = () => {
  userList.innerHTML = "";

  users.forEach((user) => {
    const userElement = document.createElement("li");
    const peer = peers.get(user.id);

    const peerText = peer ? `peer ${peer?.connectionState ?? ""}` : "";

    userElement.innerHTML = `
        ${user.id} - ${user?.name ?? "Anonymous"} ${
      localUser!.id === user.id ? "(me)" : ""
    } ${peerText}
      `;

    userList.appendChild(userElement);
  });
};

export const removeUserElementFromList = (userId: string) => {
  const video = document.getElementById(userId) as HTMLVideoElement | null;

  if (video) {
    videoContainer.removeChild(video);
    renderUsers();
  }
};
