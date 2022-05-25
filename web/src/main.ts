import "./style.css";
import { io } from "socket.io-client";
import { IUser } from "./types";

// const app = document.querySelector<HTMLDivElement>("#app")!;
const socketStatus = document.querySelector<HTMLDivElement>("#socket-status")!;
const userList = document.querySelector<HTMLUListElement>("#user-list")!;
const cameraBtn = document.querySelector<HTMLButtonElement>("#open-camera")!;
const debugBtn = document.querySelector<HTMLButtonElement>("#debug-btn")!;
const videoContainer =
  document.querySelector<HTMLDivElement>("#video-container")!;

const users = new Map<string, IUser>();
const peers = new Map<string, RTCPeerConnection>();

let localUser: IUser | null = null;
let localStream: MediaStream | null = null;

const socket = io("http://localhost:3333/", {
  reconnection: true,
});

socketStatus.innerHTML = `Connecting...`;

socket.on("connect", () => {
  socketStatus.innerHTML = `Connected`;
});

socket.on("user-joined", (user: IUser) => {
  users.set(user.id, user);
  createOffer(user.id);
  renderUsers();
});

socket.on("user-leaved", (userId: string) => {
  users.delete(userId);
  const video = document.getElementById(userId) as HTMLVideoElement | null;

  if (video) {
    videoContainer.removeChild(video);
  }

  renderUsers();
});

socket.on("welcome", (user: IUser, remoteUsers: IUser[]) => {
  localUser = user;
  users.set(user.id, user);
  remoteUsers.forEach((remoteUser) => {
    users.set(remoteUser.id, remoteUser);
  });

  renderUsers();
});

socket.on("disconnect", () => {
  socketStatus.innerHTML = `Disconnected`;
});

socket.on("connect_error", (err) => {
  socketStatus.innerHTML = `Connect Error ${err}`;
});

socket.on("web-rtc:candidate", (from: IUser, candidate) => {
  const peer = peers.get(from.id);
  if (peer) {
    peer.addIceCandidate(new RTCIceCandidate(candidate));
  } else {
    console.error("not found peer for candidate", from.id);
  }
});

socket.on("web-rtc:offer", async (from: IUser, offer) => {
  const peer = initPeerConnection(from.id);
  await peer.setRemoteDescription(offer);
  addLocalTracks(peer);

  const answer = await peer.createAnswer();
  peer.setLocalDescription(answer);
  socket.emit("web-rtc:answer", from.id, answer);
});

socket.on("web-rtc:answer", (from: IUser, answer) => {
  const peer = peers.get(from.id);

  if (peer) {
    peer.setRemoteDescription(answer);
  } else {
    console.error("not found peer for answer", from.id);
  }
});

const renderUsers = () => {
  const renderUser = (user: IUser) => {
    const userElement = document.createElement("li");
    const peer = peers.get(user.id);

    const peerText = peer ? `peer ${peer?.connectionState ?? ""}` : "";

    userElement.innerHTML = `
    ${user.id} - ${user?.name ?? "Anonymous"} ${
      localUser?.id === user.id ? "(me)" : ""
    } ${peerText}
  `;

    return userElement;
  };

  userList.innerHTML = "";

  users.forEach((user) => {
    userList.appendChild(renderUser(user));
  });
};

const initPeerConnection = (userId: string) => {
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const peer = new RTCPeerConnection(iceServers);
  peers.set(userId, peer);

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("web-rtc:candidate", userId, event.candidate);
    }
  };

  peer.ontrack = (event) => {
    const stream = event.streams[0];
    console.log("Remote track added", stream, userId);
    renderVideo(stream, userId);
  };

  peer.onconnectionstatechange = () => {
    renderUsers();
  };

  renderUsers();

  return peer;
};

async function createOffer(userId: string) {
  if (!localStream) {
    return;
  }

  const peer = initPeerConnection(userId);
  addLocalTracks(peer);

  const offer = await peer.createOffer();
  peer.setLocalDescription(offer);
  socket.emit("web-rtc:offer", userId, offer);

  return peer;
}

cameraBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  localStream = stream;

  users.forEach(async (user) => {
    if (user.id === localUser?.id) {
      return;
    }
    if (!peers.has(user.id)) {
      await createOffer(user.id);
    }
  });

  cameraBtn.disabled = true;
  renderVideo(localStream, socket!.id);
};

debugBtn.onclick = () => {
  console.debug("users", users);
  console.debug("peers", peers);
};

const renderVideo = (stream: MediaStream, userId: string) => {
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

function addLocalTracks(peer: RTCPeerConnection) {
  if (!localStream) {
    return;
  }

  localStream.getTracks().forEach((track) => {
    peer.addTrack(track, localStream!);
  });

  console.log("Local tracks added");
}
