cd /tmp/f/src
x=$1
for k in 0 1 2 3 4 5; do EXPR=$x MODE=slab SLAB=$k python3 sdf_head_K.py >/dev/null || exit 1; done
EXPR=$x MODE=mesh DECIMATE=0.5 python3 sdf_head_K.py 2>&1 | tail -2
EXPR=$x python3 export_K.py | tail -2
