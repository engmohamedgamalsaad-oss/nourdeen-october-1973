import mediapipe as mp, numpy as np, sys
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
from PIL import Image
refs={'stand':'/downloads/image-de4a722b.jpg','wave':'/downloads/image-0b5b46c1.jpg','clasp':'/downloads/image-89132d01.jpg'}
# identify by content later; crop head region for detection
opts=vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path='/tmp/face_landmarker.task'),num_faces=1,output_facial_transformation_matrixes=True)
d=vision.FaceLandmarker.create_from_options(opts)
out={}
for k,p in refs.items():
    im=Image.open(p).convert('RGB'); W,H=im.size
    crop=im.crop((int(W*.25),0,int(W*.75),int(H*.42)))
    crop=crop.resize((crop.width*2,crop.height*2),Image.LANCZOS); crop.save(f'crop_{k}.png')
    r=d.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=np.array(crop)))
    if not r.face_landmarks: print(k,'none'); continue
    L=np.array([[q.x*crop.width,q.y*crop.height,q.z*crop.width] for q in r.face_landmarks[0]])
    np.save(f'lm_{k}.npy',L); print(k,im.size,L.shape)
    M=np.array(r.facial_transformation_matrixes[0]); print(np.round(M[:3,:3],2).tolist())
