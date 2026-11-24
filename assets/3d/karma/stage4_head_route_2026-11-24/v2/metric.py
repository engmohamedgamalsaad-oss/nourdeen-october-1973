import cv2,numpy as np,mediapipe as mp,json,sys
ids=dict(face_l=234,face_r=454,chin=152,eyeL_o=33,eyeL_i=133,eyeR_i=362,eyeR_o=263,nose_tip=1,nose_l=129,nose_r=358,mouth_l=61,mouth_r=291,lip_t=13,lip_b=14,browL=105,browR=334,jawL=172,jawR=397,cheekL=50,cheekR=280)
def ratios(img,crop=None):
    im=cv2.imread(img)
    if crop: x0,y0,x1,y1=crop;im=im[y0:y1,x0:x1]
    fm=mp.solutions.face_mesh.FaceMesh(static_image_mode=True,refine_landmarks=True,max_num_faces=1)
    r=fm.process(cv2.cvtColor(im,cv2.COLOR_BGR2RGB))
    if not r.multi_face_landmarks: return None
    l=np.array([[p.x*im.shape[1],p.y*im.shape[0]] for p in r.multi_face_landmarks[0].landmark])
    iL,iR=l[468],l[473];a=np.arctan2(iR[1]-iL[1],iR[0]-iL[0]);c=(iL+iR)/2
    R=np.array([[np.cos(-a),-np.sin(-a)],[np.sin(-a),np.cos(-a)]]);q=(l-c)@R.T;ipd=np.linalg.norm(iR-iL)
    return {k:q[v]/ipd for k,v in ids.items()}
if __name__=='__main__':
    ref=ratios('/downloads/karma_preserved_stage0/refs/image-c13b2b9f.jpg',(330,100,760,560))
    me=ratios(sys.argv[1])
    tot=0;n=0
    print('%-9s %14s %14s %7s'%('pt','ref(x,y)','mine(x,y)','err'))
    for k in ids:
        e=np.linalg.norm(ref[k]-me[k]);tot+=e;n+=1
        print('%-9s %6.2f,%6.2f  %6.2f,%6.2f  %6.2f'%(k,*ref[k],*me[k],e))
    print('mean err (pupil-distance units): %.3f'%(tot/n))
    # derived feature measures
    def m(r):
        ew=(abs(r['eyeL_o'][0]-r['eyeL_i'][0])+abs(r['eyeR_o'][0]-r['eyeR_i'][0]))/2
        return dict(face_w=abs(r['face_r'][0]-r['face_l'][0]),face_h=r['chin'][1]-(-0.79),eye_w=ew,inner_gap_over_eyew=abs(r['eyeR_i'][0]-r['eyeL_i'][0])/ew,mouth_w=abs(r['mouth_r'][0]-r['mouth_l'][0]),jaw_w=abs(r['jawR'][0]-r['jawL'][0]),chin_y=r['chin'][1],nose_w=abs(r['nose_r'][0]-r['nose_l'][0]))
    a,b=m(ref),m(me)
    for k in a: print('%-20s ref %.2f mine %.2f'%(k,a[k],b[k]))
