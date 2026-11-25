# Paths for all scripts. Override with environment variables.
import os
SRC=os.path.dirname(os.path.abspath(__file__))
OUT=os.environ.get('V_OUT', os.path.dirname(SRC))            # this attempt_V folder
MH=os.environ.get('V_MH_DATA', os.path.join(SRC,'makehuman_clone','makehuman','data'))+'/'  # clone of makehumancommunity/makehuman at a8bc2d54...
REPO=os.environ.get('V_REPO', os.path.abspath(os.path.join(OUT,*['..']*5)))  # repo root (for attempt_Q GLBs)
REFDIR=os.environ.get('V_REFDIR','')  # folder with the 3 reference photos (not published)
