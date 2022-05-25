import "./style.css";
import { io } from "socket.io-client";
import { IUser } from "./types";
import {
  removeUserElementFromList,
  renderStatus,
  renderUsers,
  renderVideo,
} from "./renders";

const cameraBtn = document.querySelector<HTMLButtonElement>("#open-camera")!;
const debugBtn = document.querySelector<HTMLButtonElement>("#debug-btn")!;

export const users = new Map<string, IUser>();
export const peers = new Map<string, RTCPeerConnection>();

export let localUser: IUser | null = null;
export let localStream: MediaStream | null = null;

const socket = io("http://localhost:3333/", {
  reconnection: true,
});

renderStatus("Connecting...");
socket.on("connect", () => renderStatus("Connected"));
socket.on("disconnect", () => renderStatus("Disconnected"));
socket.on("connect_error", (err) => renderStatus("Connection error", err));

socket.on("user-joined", (user: IUser) => {
  users.set(user.id, user);
  createOffer(user.id);
  renderUsers();
});

socket.on("user-leaved", (userId: string) => {
  users.delete(userId);
  removeUserElementFromList(userId);
});

socket.on("welcome", (user: IUser, remoteUsers: IUser[]) => {
  localUser = user;
  users.set(user.id, user);

  for (const remoteUser of remoteUsers) {
    users.set(remoteUser.id, remoteUser);
  }

  renderUsers();
});

socket.on("web-rtc:candidate", (from: IUser, candidate: RTCIceCandidateInit) => {
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
  createAnswer(from.id, peer);
  
});

socket.on("web-rtc:answer", (from: IUser, answer) => {
  const peer = peers.get(from.id);

  if (peer) {
    peer.setRemoteDescription(answer);
  } else {
    console.error("not found peer for answer", from.id);
  }
});

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
      socket.emit("web-rtc:candidate", userId, event.candidate.toJSON());
    }
  };

  peer.ontrack = (event) => {
    const stream = event.streams[0];
    console.log("Remote track added", stream, userId);
    renderVideo(stream, userId, 'ontrack');
  };

  peer.onconnectionstatechange = () => renderUsers();

  renderUsers();

  return peer;
};

async function createAnswer(toUserId: string, peer: RTCPeerConnection) {
  const answer = await peer.createAnswer();
  peer.setLocalDescription(answer);
  socket.emit("web-rtc:answer", toUserId, answer);
}

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
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  // users.forEach(async (user) => {
  //   if (user.id === localUser?.id) {
  //     return;
  //   }
  //   if (!peers.has(user.id)) {
  //     await createOffer(user.id);
  //   } else {
  //     addLocalTracks(peers.get(user.id)!);
  //   }
  // });

  socket.emit("open_camera", localUser!);
  cameraBtn.disabled = true;
  renderVideo(localStream, socket!.id, 'onclick-camera-btn');
};

debugBtn.onclick = () => {
  console.debug("users", users);
  console.debug("peers", peers);
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
