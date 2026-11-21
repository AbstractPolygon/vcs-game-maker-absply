// Playfield offset and playfield box test for the coprocessor (DPC+). Position independent and self-contained: it is placed in the ROM as data and called through a
// pointer. p = column 0 of the playfield (the other columns follow 256 bytes apart). The block's numbers are in the function bytes.
typedef unsigned int u;
typedef unsigned char b8;
#define CF ((volatile b8*)0x40000DA4)

// A row as 32 columns, the first the top bit. Bytes 1 and 3 of a row hold their columns the other way round: swap them (and back).
static u conv(u v)
{
  u x=v;
  x=((x>>1)&0x55555555)|((x&0x55555555)<<1);
  x=((x>>2)&0x33333333)|((x&0x33333333)<<2);
  x=((x>>4)&0x0F0F0F0F)|((x&0x0F0F0F0F)<<4);
  return (x&0x00FF00FF)|(v&0xFF00FF00);
}

static u load(volatile b8 *p,u r)
{
  return conv((p[r]<<24)|(p[256+r]<<16)|(p[512+r]<<8)|p[768+r]);
}

// Built in a program for each set of functions a project needs (see offset-arm.js and the files of the prog folder): with and without -DGROUPS, and with any of the sets of functions left out: -DNOTERRAIN (the Generate terrain block, function 113, and the Playfield gravity block, functions 114 and 115), -DNOOFFSET (the Playfield offset block), -DNOBOX (the playfield box test), -DNOCIRCLE (the circle block), -DNOPIX (the pixel finding and the bounce of the ball and the missiles), -DNOFIRE (the movement of an object a Fire block launched with the playfield check on), -DNOAUDIO (the DPC+ sound engine's waveform rebuild and volume mix), -DNOTILES (the playfield tilemap), -DNONARROW (its 4-pixel tiles) and -DNORUNS (the backgrounds kept as runs)
// too) for a project with groups of columns that have separate rows, which is a good deal bigger.
// The numbers of the project's rows, put in by the generator in place of these: rows of a line = line * K[0] / 256, the last row K[1],
// whether a line is held to 191 first K[2], whether the groups of columns have separate rows K[3]. Then each group (column byte) has its
// increment and last row in the display memory instead (see G in box), put there when a background is loaded.
static const volatile b8 K[4]={0xA5,0x5A,0xC3,0x3C};

#ifdef GROUPS
// The columns of the groups that have a row r (with separate rows for each group of columns, the last rows are at G in box).
static u valid(volatile b8 *p,u r)
{
  u g,v=0;
  for (g=0;g<4;g++) if (p[1276+g]>=r) v|=0xFF000000u>>(8*g);
  return v;
}
#endif

// One offset over columns x1 to x2 (in order, in the playfield) and rows y1 to y2. grouped: the rows a group has are separate, and a row
// is only offset in the columns of the groups that have it. The pixel that leaves a row goes into the next row of the area (a belt), or with wrap (functions 76
// and 77, wrap left and wrap right) comes in at the other end of the same row.
static void pass(volatile b8 *p,u dir,u x1,u x2,u y1,u y2,u grouped,u wrap)
{
  u t,r,e,old,c,pin,mask,hi,lo,left,m;
  int step=1;
  mask=(0xFFFFFFFFu>>x1)&(0xFFFFFFFFu<<(31-x2));
  hi=0x80000000u>>x1;
  lo=1u<<(31-x2);
  r=y1;
  e=y2;
  if (dir==1||dir==3) { step=-1; r=y2; e=y1; }
  old=load(p,e);
  c=old;                              // vertical: the row that comes in first
  left=dir==1||(dir==0&&!(e&1))||(dir==5&&(e&1));
  pin=old&(left?hi:lo);               // horizontal: the pixel that comes in first
  for (;;)
  {
    old=load(p,r);
    if (dir==3||dir==4) { t=c; c=old; }
    else
    {
      left=dir==1||(dir==0&&!(r&1))||(dir==5&&(r&1));
      if (wrap) pin=old&(left?hi:lo);
      if (left) { t=((old<<1)&~lo)|(pin?lo:0); pin=old&hi; }
      else { t=((old>>1)&~hi)|(pin?hi:0); pin=old&lo; }
    }
    m=mask;
#ifdef GROUPS
    if (grouped) m&=valid(p,r);
#endif
    t=conv((old&~m)|(t&m));
    p[r]=t>>24; p[256+r]=t>>16; p[512+r]=t>>8; p[768+r]=t;
    if (r==e) break;
    r+=step;
  }
}

// Alternate columns up and down (dir 6 moves the even columns up and the odd ones down, dir 7 the other way round): a row takes the row below it
// in the columns that go up and the row above it in the others, and the first and last row of the area take each other's.
static void columns(volatile b8 *p,u dir,u x1,u x2,u y1,u y2)
{
  u r,first,cur,prev,next,t,m,up=dir==6?0xAAAAAAAAu:0x55555555u;
  m=(0xFFFFFFFFu>>x1)&(0xFFFFFFFFu<<(31-x2));
  first=cur=load(p,y1);
  prev=load(p,y2);
  for (r=y1;;r++)
  {
    next=r==y2?first:load(p,r+1);
    t=conv((cur&~m)|(((next&up)|(prev&~up))&m));
    p[r]=t>>24; p[256+r]=t>>16; p[512+r]=t>>8; p[768+r]=t;
    if (r==y2) break;
    prev=cur;
    cur=next;
  }
}

static void offset(volatile b8 *p)
{
  u op=CF[0];
  u dir=(op&3)|((op>>1)&4);          // 0 alternate, 1 left, 2 right, 3 up, 4 down, 5 alternate the other way round, 6 alternate columns up and down, 7 down and up
  u x1=CF[1],x2=CF[2],y1=CF[3],y2=CF[4],last=CF[5];   // as the block has them, and the last row of the playfield
  u t,wrap=0;
#ifdef GROUPS
  u g,gx1,gx2,gy2,rows;
#endif
  if (op==76||op==77) { dir=op-75; wrap=1; }   // wrap left, wrap right: dir 1 and 2 with the pixel kept in its row
  if (x1>31) x1=31;
  if (x2>31) x2=31;
  if (y1>last) y1=last;
  if (y2>last) y2=last;
  if (x1>x2) { t=x1; x1=x2; x2=t; }
  if (y1>y2) { t=y1; y1=y2; y2=t; }
#ifdef GROUPS
  if (K[3] && (dir==3||dir==4||dir>=6))
  {
    // Up and down: each group of columns turns round in the rows it has.
    for (g=0;g<4;g++)
    {
      gx1=x1>g*8?x1:g*8;
      gx2=x2<g*8+7?x2:g*8+7;
      rows=p[1276+g];
      if (gx1>gx2 || y1>rows) continue;
      gy2=y2>rows?rows:y2;
      if (dir>=6) columns(p,dir,gx1,gx2,y1,gy2);
      else pass(p,dir,gx1,gx2,y1,gy2,0,0);
    }
    return;
  }
#endif
  if (dir>=6) columns(p,dir,x1,x2,y1,y2);
  else pass(p,dir,x1,x2,y1,y2,K[3],wrap);
}

static u rowof(u line,u inc)
{
  if (K[2] && line>191) line=191;
  return (line*inc)>>8;
}

#ifdef GROUPS
// The first line of a row (found by halving the range).
static u startline(u row,u inc)
{
  u lo=0,hi=255,mid;
  while (lo<hi)
  {
    mid=(lo+hi)>>1;
    if (((mid*inc)>>8)>=row) hi=mid; else lo=mid+1;
  }
  return lo;
}
#endif

// The box test of pf-box.js for a player. C_function[0] = 128 | height, [1] = x, [2] = y, [3] = the sweep (0 for none; bit 7 up, the
// low 5 bits lines) and the width in bits 5 and 6 (0 normal, 1 double, 2 quad). Returns 0 for nothing, 1 for a plain test that hit, and for a sweep the number of the first row with a lit pixel (looking
// down, or up) plus one.
static u box(volatile b8 *p)
{
  u h=CF[0]&127,x=CF[1],y=CF[2],ext=CF[3];
  u e7=ext&31,up=ext>>7,kind=(ext>>5)&3;
  u ofs=kind?15:16,w1=kind==0?7:(kind==1?15:31);
  // Kind 3 is a missile or the ball: its width less one pixel in the fifth byte of the call, and the column offset (x less it over 4 is the column: 17 for the
  // ball, 14 for a missile, measured against the hardware flag) in the sixth.
#ifdef GROUPS
  if (kind==3) { ofs=CF[5]; w1=CF[4]; }
#endif
  ext&=0x9F;
  u lc,rc,first,last,s,t,bi,lo,hi,mask,r,v,cand,best=0,inc,maxrow;
  if (x>=176 || x+w1<ofs) return 0;
  rc=(x+w1-ofs)>>2;
  if (rc>31) rc=31;
  lc=x>=ofs?(x-ofs)>>2:0;
  if (lc>=32) return 0;
  s=y+h;
  t=s>255?254:(s?s-1:0);                // the bottom line of the box
  for (bi=lc>>3;bi<=(rc>>3);bi++)
  {
    inc=K[0];
    maxrow=K[1];
#ifdef GROUPS
    if (K[3]) { inc=p[1272+bi]; maxrow=p[1276+bi]; }
#endif
    if (!ext)
    {
      first=rowof(y,inc);
      last=rowof(t,inc);
    }
    else if (!up)
    {
      s=t+e7;
      if (s>255) s=255;
      first=rowof(t,inc)+1;
      last=rowof(s,inc);
    }
    else
    {
      s=y+e7;
      if (s>255) s=255;
      first=rowof(y,inc);
      last=rowof(s,inc);
      if (last==0) continue;
      last--;
    }
    if (last>maxrow) last=maxrow;
    if (first>last) continue;
    lo=lc>bi*8?lc-bi*8:0;
    hi=rc-bi*8>=8?7:rc-bi*8;
    mask=bi&1?(0xFF<<lo)&(0xFF>>(7-hi)):(0xFF>>lo)&(0xFF<<(7-hi));
    mask&=0xFF;
    for (r=up?last:first;;)
    {
      v=p[bi*256+r]&mask;
      if (v)
      {
        if (!ext) return 1;
        // With separate rows the groups answer in lines (the first line of the row, or the first below it), plus one.
        cand=r+1;
#ifdef GROUPS
        if (K[3])
        {
          cand=startline(up?r+1:r,inc)+1;
          if (cand>255) cand=255;
        }
#endif
        if (!best || (up?cand>best:cand<best)) best=cand;
        break;
      }
      if (up) { if (r==first) break; r--; }
      else { if (r==last) break; r++; }
    }
  }
  return best;
}

#ifndef NOCIRCLE
// "Playfield set/clear/flip circle" (function 96 plus the operation: 0 set, 1 clear, 2 flip). C_function[1..8]: the center column and row, the radius
// (15 at most), the padding of the left and right (15 at most) and of the top and bottom (a byte each): the columns and rows at the edges the block leaves alone and the last row
// of the playfield. A row of the circle is as wide as the biggest d with d * d <= r * r less the square of the row's distance from the center.
// A radius with bit 7 set is kept round on short rows: C_function[9] is the scale q, and a row of distance d is as wide as the row of distance d * q / 256.
static void circle(volatile b8 *p)
{
  int op=CF[0]&3,cx=CF[1],cy=CF[2],r=CF[3],pl=CF[4],pr=CF[5],pt=CF[6],pb=CF[7],last=CF[8],q=0,dm,e;
  int lo,hi,top,bot,d,y,v,h,x1,x2,bi,a,b;
  u m;
  if (r&128) { q=CF[9]; r&=127; }
  if (r>15) r=15;
  if (pl>15) pl=15;
  if (pr>15) pr=15;
  lo=pl;
  hi=31-pr;
  top=pt;
  bot=last-pb;
  if (lo>hi||top>bot) return;
  dm=r;
  if (q) { dm=0; while ((((dm+1)*q)>>8)<=r) dm++; }
  for (d=-dm;d<=dm;d++)
  {
    y=cy+d;
    if (y<top||y>bot) continue;
    e=d<0?-d:d;
    if (q) e=(e*q)>>8;
    v=r*r-e*e;
    for (h=0;(h+1)*(h+1)<=v;h++);
    x1=cx-h;
    x2=cx+h;
    if (x1<lo) x1=lo;
    if (x2>hi) x2=hi;
    for (bi=x1>>3;bi<=(x2>>3);bi++)
    {
#ifdef GROUPS
      if (K[3] && y>p[1276+bi]) continue;
#endif
      // The columns of the circle in this byte of the row (the odd bytes of a row hold their columns the other way round).
      a=x1>bi*8?x1-bi*8:0;
      b=x2-bi*8>=8?7:x2-bi*8;
      m=bi&1?(0xFF<<a)&(0xFF>>(7-b)):(0xFF>>a)&(0xFF<<(7-b));
      m&=0xFF;
      if (op==0) p[bi*256+y]|=m;
      else if (op==1) p[bi*256+y]&=~m;
      else p[bi*256+y]^=m;
    }
  }
}

#endif

#ifndef NOTERRAIN
// "Generate terrain" (function 113): the ground along one edge of the playfield, drawn in one call, the same as the steps of the 6502 engine
// (generators/bbasic/pf-draw.js, the terrain kind) make it a pixel at a time. C_function[1..8]: the side (0 bottom, 1 top, 2 left, 3 right), the least and the
// most height, the roughness, the overhangs + caves * 16 + 128 for tile, the random number the terrain starts from, the last row and the last column. The names
// are the ones of the engine: pos (the position along the edge), depth (the height there), pixel (the pixel of the line being drawn), params (roughness * 8 +
// overhangs, bit 7 a cave), over and ledge (the overhang or cave being made), caves (the caves in bits 0-2, tile in bit 3, the slope in the high bits), and the
// labels follow the engine's (k: the start of a position, f: a turn, mv: a move). Every sum is a byte, as the 6502 makes it.
#define B(v) ((v)&255)
static void tplot(volatile b8 *p,u c,u y)
{
  p[((c>>3)<<8)+y]|=1<<((c^(((c>>3)&1)?0:7))&7);
}
static u tslope(u caves,u least,u most,u seed)
{
  u t1=B(most-least)>>3,t2=(seed>>3)&3;
  if (t2==0) t1>>=1;
  if (t2==3) t1=B(t1+t1);
  if (t1==0) t1=1;
  if (t1>15) t1=15;
  return B((caves&15)+B(t1*16));
}
static void terrain(volatile b8 *p)
{
  u side=CF[1],least=CF[2],most=CF[3],rough=CF[4],packed=CF[5],seed=CF[6],maxRow=CF[7],maxCol=CF[8];
  u horiz=(side>>1)&1,first=side&1,deeper=0,last=horiz?maxRow:maxCol;
  u pos=0,depth,pixel=0,params,over=0,caves,ledge=0;
  u t1,t2,t3,t4,t5=0,t6=0,x,y;
  caves=(packed&127)>>4;
  if (caves>4) caves=4;
  if (packed>127) caves+=8;
  t5=packed&15;
  if (rough>8) rough=8;
  if (t5>4) t5=4;
  params=rough*8+t5;
  if (least>most) { t1=least; least=most; most=t1; }
  if (horiz) { if (most>maxCol+1) most=maxCol+1; }
  else { if (most>maxRow+1) most=maxRow+1; }
  if (least>most) least=most;
  if (most==0) return;
  depth=B(least+most)>>1;
  if (seed==0) seed=1;
  if (seed&1) deeper=1;
  caves=tslope(caves,least,most,seed);
  for (;;)
  {
    // The line of this position.
    for (;;)
    {
      if (pixel>=depth)
      {
        if (params&128) break;
        t1=ledge;
        if (t1==0||pixel>=t1) break;
        // (An overhang to the right gets thinner toward its tip, one to the left (high nibble of over 2 or more: its length less 1) thicker toward the hill.)
        t3=over>>4;
        t2=B(B((ledge>>4)+1)+(t3>=2?B(t3-(over&15)):(over&15)));
        t2=B(t1-t2);
        if (t2>t1) t2=0;
        if (pixel<t2) pixel=t2;
      }
      if (!horiz) { x=pos; y=first?pixel:B(maxRow-pixel); }
      else { y=pos; x=first?B(maxCol-pixel):pixel; }
      tplot(p,x,y);
      pixel=B(pixel+1);
      if (params&128)
      {
        t1=over>>4;
        t3=B(B(ledge-t1)>>1);
        t3=B((depth>>1)+t3);
        if (pixel==t3) pixel=B(pixel+t1);
      }
    }
    // The next position.
    pos=B(pos+1);
    if (pos>last) return;
    t5=B(seed*2); seed^=t5;
    t5=seed>>1; seed^=t5;
    t5=B(seed*4); seed^=t5;
    if (caves&8)
    {
      t1=B(last-pos);
      t3=caves>>4;
      if (t3>=2) t1=B(t1+t1);
      if (t3>=4) t1=B(t1+t1);
      if (t3>=8) t1=B(t1+t1);
      t4=B(least+most)>>1;
      t5=depth>t4?B(depth-t4):B(t4-depth);
      if (t5>t1)
      {
        t5=B(t5-t1);
        if (depth>t4) { depth=B(depth-t5); deeper=0; }
        else { depth=B(depth+t5); deeper=1; }
        goto k;
      }
    }
    t5=seed>>5;
    t6=B(((params&127)>>3)*2);
    if (t5==0) goto f;
    if (t6>=6)
    {
      t1=seed&7;
      t2=B((t6>>1)-2);
      if (t1<t2) goto f;
    }
  q2:
    if (t5>t6) goto k;
  mv:
    t1=caves>>4;
    if (t1==0) t1=1;
    t2=(seed>>2)&3;
    if (t2==1) t1>>=1;
    if (t2==0) t1=1;
    if (t1==0) t1=1;
    if (deeper) goto d;
    if (depth<=least) goto t;
    t2=B(depth-least);
    if (t2<t1) t1=t2;
    depth=B(depth-t1);
    goto k;
  t:
    if (least>=most) goto k;
    deeper=1;
    caves=tslope(caves,least,most,seed);
    goto mv;
  d:
    if (depth>=most) goto b;
    t2=B(most-depth);
    if (t2<t1) t1=t2;
    depth=B(depth+t1);
    goto k;
  b:
    if (least>=most) goto k;
    deeper=0;
    caves=tslope(caves,least,most,seed);
    goto mv;
  f:
    t1=B((caves>>4)*2);
    if (deeper) t2=B(depth-least); else t2=B(most-depth);
    if (t2<t1)
    {
      if (t5==0) goto k;
      goto q2;
    }
    deeper^=1;
    caves=tslope(caves,least,most,seed);
  k:
    pixel=0;
    if (over!=0) goto r;
    t1=params&7;
    if (t1==0) goto v;
    if (depth<=3) continue;
    t1=B(t1*3);
    t2=seed&15;
    if (t2>=t1) goto v;
    t4=B(((seed>>2)&3)+3);
    if (deeper) goto lo;
    // The ground drops under the ledge by more than the ledge is thick (see the overhang start in pf-draw.js), so a void shows under it.
    if (depth<=least) goto v;
    t1=B((depth>>4)+t4);
    t2=B(B((depth>>3)+t1)+2);
    t3=B(depth-least);
    if (t2>t3) t2=t3;
    if (t2<=t1) goto v;
    ledge=depth;
    depth=B(depth-t2);
    over=B(t4+16);
    goto r;
  lo:
    // Where the ground is rising, an overhang to the left: the ground stays low for the length of it, under a ledge at the height it goes up to (thin at its tip,
    // thicker toward the hill), and goes up there at the end (see r).
    if (depth>=most) goto v;
    t1=B((depth>>4)+t4);
    t2=B(B((depth>>3)+t1)+2);
    t3=B(most-depth);
    if (t2>t3) t2=t3;
    if (t2<=t1) goto v;
    ledge=B(depth+t2);
    over=B(t4+B((t4-1)*16));
    goto r;
  v:
    t1=caves&7;
    if (t1==0) continue;
    if (depth<8) continue;
    t1=B(t1*4);
    t2=seed>>4;
    if (t2>=t1) continue;
    params|=128;
    t3=B((depth>>2)+((seed>>4)&1));
    if (t3>15) t3=15;
    if (t3==0) t3=1;
    ledge=t3;
    t4=B(((seed>>2)&3)+2);
    over=t4;
  r:
    if ((over&15)==0)
    {
      if (!(params&128)&&(over>>4)>=2) depth=ledge;
      over=0;
      ledge=0;
      params&=127;
      continue;
    }
    over=B(over-1);
    if (!(params&128)) continue;
    t1=over&15;
    t2=ledge;
    t3=over>>4;
    if (t3==0||t1==0)
    {
      t2>>=1;
      if (t2==0) t2=1;
    }
    over=B(t1+B(t2*16));
  }
}

// "Playfield gravity" (function 114, with the terrain: the set k): the pixels of an area fall, as the steps of the 6502 engine make them (generators/bbasic/pf-draw.js,
// the gravity). C_function[1..4]: the first column, the first row, the last column and the last row of the area (already cut to the playfield). Each column goes from its
// lowest row up: a pixel that is on moves to the lowest row not taken, and the row after is the one above it.
static void pfgravity(volatile b8 *p)
{
  u x1=CF[1],y1=CF[2],x2=CF[3],y2=CF[4],c,r,land,base,m;
  for (c=x1;c<=x2;c++)
  {
    base=(c>>3)<<8;
    m=1<<((c^(((c>>3)&1)?0:7))&7);
    land=y2;
    for (r=y2;;r--)
    {
      if (p[base+r]&m)
      {
        if (r!=land)
        {
          p[base+r]&=~m;
          p[base+land]|=m;
        }
        land--;
      }
      if (r==y1) break;
    }
  }
}
// One step of the pixels falling over time (function 115): every row from the one above the last up to the first, left to right, a pixel that is on with a pixel that is off
// under it moves down one row (so a stack of pixels moves as one). The same arguments as pfgravity; C_function[1] gives back 1 when a pixel moved, 0 when none did.
static void pfgravstep(volatile b8 *p)
{
  u x1=CF[1],y1=CF[2],x2=CF[3],y2=CF[4],c,r,moved=0,base,m;
  for (r=y2;r>y1;r--)
  {
    for (c=x1;c<=x2;c++)
    {
      base=(c>>3)<<8;
      m=1<<((c^(((c>>3)&1)?0:7))&7);
      if ((p[base+r-1]&m)&&!(p[base+r]&m))
      {
        p[base+r-1]&=~m;
        p[base+r]|=m;
        moved=1;
      }
    }
  }
  CF[1]=moved;
}

#endif

#if !defined(NOPIX) || !defined(NOFIRE)
// A playfield pixel as the 6502's pfread has it: column c is in byte c / 8 of its row, the odd bytes with their columns the other way round.
static u pixel(volatile b8 *p,u c,u r)
{
  return (p[((c>>3)<<8)+r]>>((c^(((c>>3)&1)?0:7))&7))&1;
}
#endif

#ifndef NOPIX
// The column of an x (held to the playfield's 32) and the row of a line (held to the last row). The row is the line * inc / 256 (an inc of 0 is 256: rows of
// one line, as with 192 rows, as 256 does not fit in the byte it is given in), or with div the line / inc (rows a whole number of lines that does not divide
// 256, 3 or 6 lines for 64 or 32 rows: the 6502's division, which no inc gives for every line).
static u rowat(u y,u inc,u div)
{
  u r=0;
  y&=255;
  if (!div||!inc) return (y*(inc?inc:256))>>8;
  while (y>=inc) { y-=inc; r++; }
  return r;
}
static u cellcol(u x,u off) { u c=((x-off)&255)>>2; return c>31?31:c; }
static u cellrow(u y,u inc,u maxrow,u div) { u r=rowat(y,inc,div); return r>maxrow?maxrow:r; }

// The playfield pixel the ball or a missile has touched (the "Find playfield pixel collided with" block's routine of generators/bbasic/background.js) and
// the direction it turns to on a bounce (the shared reflect routine of object_bounce in generators/bbasic/sprites.js), worked out here instead of
// by the 6502 (about 350 and 900 cycles). The playfield is read the way the 6502's pfread does: column c is in byte c / 8 of its row, the odd bytes
// with their columns the other way round. All the arithmetic is in bytes, as the 6502's is (an x less than the offset wraps round and is held to 31).

// The horizontal (1 right, 2 left) and the vertical (1 down, 2 up) step of each of the 16 directions, and of the 8 of a Fire block without 16 directions.
static const b8 XSTEP16[16]={0,1,1,1,1,1,1,1,0,2,2,2,2,2,2,2};
static const b8 YSTEP16[16]={2,2,2,2,0,1,1,1,1,1,1,1,0,2,2,2};

static u xstep(u dir,u steps) { return dir>=steps?0:XSTEP16[steps==16?dir:dir<<1]; }
static u ystep(u dir,u steps) { return dir>=steps?0:YSTEP16[steps==16?dir:dir<<1]; }
static u more(u v,u last) { return v<last?v+1:v; }
static u less(u v) { return v>0?v-1:v; }

// C_function[1..9]: x, the top line, the height in lines (0 for none), the size bits ($30 mask), the direction, 8 or 16 directions (bit 7: the row is the line /
// the increment, see rowat), the last row,
// the column offset (x less this over 4 is the column), the row increment (a line * it / 256 is the row). Gives back the column and the row in [1] and [2].
static void findpixel(volatile b8 *p)
{
  u x=CF[1],top=CF[2],height=CF[3],size=CF[4]&0x30,dir=CF[5],steps=CF[6]&0x7F,div=CF[6]&0x80,maxrow=CF[7],off=CF[8],inc=CF[9];
  u xs=xstep(dir,steps),ys=ystep(dir,steps);
  u col,right,row,bottom,cb,rb,w,t;
  col=cellcol(x,off);
  w=size==0?0:(size==0x10?1:(size==0x20?3:7));
  right=cellcol(x+w,off);
  row=cellrow(top,inc,maxrow,div);
  bottom=row;
  if (height)
  {
    t=rowat(top+height-1,inc,div);
    bottom=t>maxrow?maxrow:t;
    if (bottom<row) bottom=row;
  }
  if (xs==1) cb=more(right,31);
  else if (xs==2) cb=less(col);
  else cb=col;
  if (ys==1) rb=more(bottom,maxrow);
  else if (ys==2) rb=less(row);
  else rb=row;
  {
    // The cells in the order they are looked at: the first lit one is the answer, and when none is, the one ahead.
    u cs[8],rs[8],i;
    cs[0]=col; cs[1]=right; cs[2]=col; cs[3]=right; cs[4]=col; cs[5]=right; cs[6]=cb; cs[7]=cb;
    rs[0]=row; rs[1]=row; rs[2]=bottom; rs[3]=bottom; rs[4]=rb; rs[5]=rb; rs[6]=row; rs[7]=bottom;
    for (i=0;i<8;i++) if (pixel(p,cs[i],rs[i])) break;
    col=i<8?cs[i]:cb;
    row=i<8?rs[i]:rb;
  }
  CF[1]=col;
  CF[2]=row;
}

// The whole of a Bounce block's frame (the stage code of object_bounce in generators/bbasic/sprites.js, with the reflect routine in it) for an object with a Fire
// heading: C_function[1..10]: x, the top line, the direction, 8 or 16 directions (bit 7: the row is the line / the increment), the last row, the column offset, the row increment, the stage byte, 1 for an object with Gravity and its fall speed. Gives back the
// direction and the stage byte in [1] and [2]. The first frame of a bounce turns the heading from the pixels around the cell the object is in: a straight vertical
// heading flips the vertical, a straight horizontal one the horizontal, a diagonal one looks at the cells (stepping back out of the wall first when it is inside it)
// and flips what they say was hit. The next ones wait, and the fourth gives up on the new heading and turns the old one right round.
static void bouncepix(volatile b8 *p)
{
  u x=CF[1],top=CF[2],dir=CF[3],steps=CF[4]&0x7F,div=CF[4]&0x80,maxrow=CF[5],off=CF[6],inc=CF[7],stage=CF[8];
  u half=steps>>1,col,row,t,xs,ys,left,up,mostly_y,flip,bcol,brow,mark=stage&48,grav=CF[9],gsp=CF[10];
  stage|=64;
  if (mark==16) { CF[1]=dir; CF[2]=(stage&207)|32; return; }
  if (mark==32) { CF[1]=dir; CF[2]=(stage&207)|48; return; }
  if (mark==48)
  {
    dir=(stage&15)+half;
    if (dir>=steps) dir-=steps;
    CF[1]=dir;
    CF[2]=(stage&207)|48;
    return;
  }
  stage=(dir&15)|64;
  xs=xstep(dir,steps);
  ys=ystep(dir,steps);
  // An object with Gravity (grav 1, its fall speed in gsp): the fall speed gives the vertical way (a heading that goes up or down and along x met what gravity brought it
  // down onto, and one along x only is falling, or rising, too); a fall speed of 0 keeps the heading's way, or is down.
  if (grav && xs && dir<steps) { if (gsp>127) ys=2; else if (gsp || !ys) ys=1; }
  left=xs==2;
  up=ys==2;
  if (dir>=steps) flip=3;
  else if (!xs) flip=2;
  else if (!ys) flip=1;
  else
  {
    mostly_y=steps==16 && (dir==1||dir==7||dir==9||dir==15);
    col=cellcol(x,off);
    row=cellrow(top,inc,maxrow,div);
    if (pixel(p,col,row))
    {
      // Inside a wall: the base is the cell just outside it, found by stepping back along the axis the object came in on.
      bcol=left?more(col,31):less(col);
      brow=up?more(row,maxrow):less(row);
      {
        // The pixel one step back along the heading says which way it came in: only the column changed, along x; only the row, along y.
        // (Both or neither: the heading decides, as in the 6502's reflect.)
        u cx=(((x-off)&3)==(left?3:0)),cy=rowat(top+(up?1:255),inc,div)!=row;
        if (cx&&!cy) mostly_y=0;
        else if (cy&&!cx) mostly_y=1;
      }
      {
        // (The cell with the row stepped back is tried first for a mostly vertical heading, the one with the column stepped back first otherwise.)
        u c1=mostly_y?col:bcol,r1=mostly_y?brow:row,c2=mostly_y?bcol:col,r2=mostly_y?row:brow;
        if (!pixel(p,c1,r1)) { col=c1; row=r1; }
        else if (!pixel(p,c2,r2)) { col=c2; row=r2; }
        else { col=bcol; row=brow; }
      }
    }
    // The pixel beside the base cell along x (A) and the one beside it along y (B) say what was hit.
    bcol=left?less(col):more(col,31);
    brow=up?less(row):more(row,maxrow);
    {
      u pa=pixel(p,bcol,row),pb=pixel(p,col,brow);
      flip=pa?(pb?3:1):(pb?2:3);
    }
  }
  if (flip==1) { t=steps-dir; dir=t==steps?0:t; }
  else if (flip==2) dir=dir>half?steps+half-dir:half-dir;
  else if (flip==3) { dir+=half; if (dir>=steps) dir-=steps; }
  CF[1]=dir;
  // Bit 7 asks the 6502 for the bounce of the fall speed (the vertical way was turned).
  CF[2]=(stage&207)|16|((grav && flip>1)?128:0);
}
#endif

#ifndef NOFIRE
// The movement of the objects Fire blocks launched, for one frame (the "missilefire" code of generateMissileFireChecks in generators/bbasic/sprites.js, which
// the 6502 does when this is not in the program), for up to 8 objects in one call (function 102). The numbers of each object that do not change while the game
// runs are in FT (the table at the end of the program, see fireTableLines in generators/bbasic/offset-arm.js): FT[0] the number of objects, then 14 bytes for
// each: the flags (bit 0: 16 directions, bit 1: checks the playfield while it moves, bits 2 and 3: the top line is y + 1 (1) or y - 1 (2) for the cell it is
// in, bit 6: the row is the line / the row increment, rows a whole number of lines that does not divide 256, bit 7: the same speed at every angle, a straight
// heading takes 7/16 of the speed more), the column offset, the last row and the row increment, then where the direction,
// the speed, the sixteenths kept (the halfway directions and the stretch), the stage byte of the Bounce and the sixteenths of the same speed at every angle
// are: two bytes each, the place in the display memory (the low byte, then the high one's low four bits), or with bit 7 of the high byte the next byte the 6502
// wrote, or with bit 6 a number (the low byte: 0 for none, or the speed when it is always the same).
// C_function[1] the first object of the call in FT, [2] the ones that move this frame (bit 0 the first), then each object's x, y and the bytes of it the
// 6502 wrote. Gives back from [1]: the ones that moved (not a speed of 0), then each object's x, y and the sixteenths kept, the stage byte and the sixteenths
// of the same speed when the 6502 wrote them (the ones in the display memory are written there).
// (Each step plus 2, for the tables are bytes: the coprocessor emulators have no signed loads.)
static const b8 DX16[16]={2,3,3,4,3,4,3,3,2,1,1,0,1,0,1,1};
static const b8 DY16[16]={1,0,1,1,2,3,3,4,3,4,3,3,2,1,1,0};
// Put over by the generated table (see above): the last bytes of the program.
static const volatile b8 FT[4] __attribute__((section(".firetab")))={0x5E,0xF1,0x7A,0xB1};

// One object's numbers for a move, a[0] to a[10]: the direction, the speed, the sixteenths kept, the stage byte, the sixteenths of the same speed at every
// angle (in the order of their places in FT), x, y, the flags, the column offset, the last row, the row increment. The move gives back x, y, the sixteenths
// kept and the stage byte in the same places.

// Whether the cell an object at x, y is in is lit.
// 0 for a clear cell (or none), else 1 + a number of the lit cell: its column xor 8 times its row (different for neighbouring cells).
static u lit(volatile b8 *p,const b8 *a,u x,u y)
{
  u fl=a[7],shift=(fl&4)?1:((fl&8)?255:0),inc=a[10],col=((x-a[8])&255)>>2,row=(y+shift)&255;
  // (The row as rowat has it: an increment of 0 is 256, bit 6 divides.)
  if ((fl&0x40)&&inc) { u r=0; while (row>=inc) { row-=inc; r++; } row=r; }
  else row=(row*(inc?inc:256))>>8;
  if (col>31 || row>a[9]) return 0;
  return pixel(p,col,row)?1+((col^(row<<3))&255):0;
}

static void firemove(volatile b8 *p,b8 *a)
{
  u x=a[5],y=a[6],dir=a[0],speed=a[1],frac=a[2],fl=a[7],stage=a[3],steps=(fl&1)?16:8;
  u t3,t4,t5=0,n,start,cell,i=(fl&1)?dir:dir<<1,big=2,mv=26,nv=0;
  int dx=0,dy=0,sx,sy,px,py,mx,my;
  if (dir<steps) { dx=(int)DX16[i]-2; dy=(int)DY16[i]-2; }
  sx=dx>0?1:(dx<0?-1:0);
  sy=dy>0?1:(dy<0?-1:0);
  // The stretch of the vertical movement (stretchRow in generators/bbasic/sprites.js): the main axis (big: 1 sideways, 2 vertical) takes mv sixteenths of the speed a
  // frame (16 of them are the speed itself, added after), the other axis nv sixteenths: a pixel is about 1.6 lines wide on a TV. The leftover sixteenths of each
  // are kept in frac (low nibble: the main axis, high nibble: the other).
  if (i&1) { if (dy==2||dy==-2) { mv=33; nv=9; } else { big=1; mv=21; nv=14; } }
  else if (i&2) nv=16;
  else if (dy==0) { big=1; mv=16; }
  t3=speed*(mv-16)+(frac&15);
  t4=speed*nv+(frac>>4);
  frac=(t3&15)|((t4&15)<<4);
  t3=(t3>>4)+speed;
  t4=t4>>4;
  // A step at a time: the main axis one pixel, and the other axis now and then (t4 pixels in t3 steps).
  px=big==1?sx:0;
  py=big==2?sy:0;
  mx=(big==2&&nv)?sx:0;
  my=(big==1&&nv)?sy:0;
  stage&=127;
  // An object that starts inside a lit cell is stopped by any other lit cell it comes to, not by the one it is in.
  start=lit(p,a,x,y);
  n=t3;
  do
  {
    u moved=0;
    x+=px;
    y+=py;
    for (;;)
    {
      // A lit cell stops the object (see start above); the step into it is taken back, as far as it was taken.
      if ((cell=lit(p,a,x,y)) && (!start || (cell!=start && !((stage&0x30)==0x30 && (dir&15)!=(stage&15))) || (cell==start && !(stage&0x30))))
      {
        if (!start) stage&=207;
        if (start && cell!=start) { if (moved) { x-=mx; y-=my; } else { x-=px; y-=py; } }
        goto done;
      }
      // (The other axis moves after the main one: t4 pixels in t3 steps.)
      if (moved || !t4) break;
      t5+=t4;
      if (t5<t3) break;
      t5-=t3; x+=mx; y+=my; moved=1;
    }
    n--;
  } while (n>0);
  done:;
  a[5]=x;
  a[6]=y;
  a[2]=frac;
  a[3]=stage;
}

static void firebatch(volatile b8 *p)
{
  u first=CF[1],go=CF[2],moved=0,i,k;
  volatile b8 *in=CF+3,*out=CF+2;
  const volatile b8 *d=FT+1+first*14;
  for (i=0;i<8 && first+i<FT[0];i++,d+=14)
  {
    // (Each object's bytes are all read before the ones it gives back are written: what it gives back is never more than what it was given, so the bytes given back
    // never reach the ones of the next objects.)
    b8 a[11];
    a[5]=*in++;
    a[6]=*in++;
    a[7]=d[0]; a[8]=d[1]; a[9]=d[2]; a[10]=d[3];
    // The direction, the speed, the sixteenths kept, the stage byte and the sixteenths of the same speed at every angle (see FT above).
    for (k=0;k<5;k++)
    {
      u lo=d[4+2*k],hi=d[5+2*k];
      a[k]=(hi&0x80)?*in++:((hi&0x40)?lo:*(volatile b8 *)(0x40000C00+lo+((hi&15)<<8)));
    }
    if (((go>>i)&1) && a[1])
    {
      // The same speed at every angle: a straight heading (a multiple of 2 of the 8 directions, of 4 of the 16) adds 7/16 of the speed, the sixteenths kept in a[4].
      if ((a[7]&0x80) && !(a[0]&((a[7]&1)?3:1)))
      {
        u t=a[1]*7+(a[4]&15);
        a[4]=t&15;
        a[1]+=(t&255)>>4;
      }
      a[4]&=15;
      firemove(p,a);
      moved|=1u<<i;
    }
    *out++=a[5];
    *out++=a[6];
    for (k=2;k<5;k++)
    {
      u lo=d[4+2*k],hi=d[5+2*k];
      if (hi&0x80) *out++=a[k];
      else if (!(hi&0x40)) *(volatile b8 *)(0x40000C00+lo+((hi&15)<<8))=a[k];
    }
  }
  CF[1]=moved;
}
#endif

#ifndef NOAUDIO
// The DPC+ sound engine (generators/bbasic/dpcplus-audio.js), kept here so that its code is in the ROM as data in another bank instead of in the bank
// next to the kernel, where it took about 200 bytes.
// Function 104, the rebuild of a voice's waveform: CF[1] and CF[2] = where the waveforms are in the ROM (the low byte, then the high byte with the bank in its upper
// bits, as the sprite pointers are), 8 waveforms of 32 samples (0 to 15), two to a byte, the first in the low nibble. CF[3] = RAM slot of the voice (display RAM
// address / 32), CF[4] = waveform number * 16 + height. Writes the 32 samples of the waveform scaled to the height (a sample * height / 15, rounded), the first two
// bytes carrying the waveform and the height in their high nibbles.
static void audiowave(void)
{
  const b8 *src=(const b8 *)(0xC00+(CF[2]<<8)+CF[1]+((CF[4]>>4)<<4));
  volatile b8 *dst=(volatile b8 *)(0x40000C00+((CF[3]&0x7f)<<5));
  u height=CF[4]&15;
  u k;
  for (k=0;k<32;++k)
  {
    u value=((((src[k>>1]>>((k&1)<<2))&15)*height*17+134)>>8);
    if (k<2) value|=(k==0)?(CF[4]&0xF0):(height<<4);
    dst[k]=value;
  }
}

// Function 105, the volume mix: CF[1] to CF[3] = the volumes (0 to 15) of up to three voices. When they add up to more than the 15 the chip's output has, each
// is scaled down by 15 over the total (a voice that sounds keeps at least 1); the results are written back to CF[1] to CF[3].
static void audiomix(void)
{
  u total=CF[1]+CF[2]+CF[3];
  u k;
  if (total>15)
  {
    for (k=1;k<4;++k)
    {
      u rest=CF[k]*15;
      u share=0;
      for (;rest>=total;++share) rest-=total;
      CF[k]=(share==0 && CF[k]!=0)?1:share;
    }
  }
}
#endif

#ifndef NOTILES
// The playfield tilemap (generators/bbasic/pf-tiles.js): a background kept as tiles one column (8 pixels) wide, read from the ROM (an address is
// given as the low byte and the high byte with the bank in its upper bits, as the sprite pointers are). A background's description: the address of its
// map (low, high), of the tiles (low, high), the rows of a tile, the rows of the map, and the rows to fill (0: the map once; more: the map again from its
// top, the scrolling memory). The map has 4 tile numbers a row (PF1L, PF2L, PF1R, PF2R); a tile is its rows' bytes one after the other, each as
// drawn (its left pixel in bit 7): the PF2 columns (1 and 3) draw their bits the other way round, so a tile's bytes are reversed for them. With bit 7
// of the rows of a tile set (flips), a tile number with bit 7 set is the tile of the low 7 bits flipped left to right: its bytes are reversed the other
// way. With bit 6 of it set the tiles are 4 pixels wide: the map has 8 tile numbers a row, a tile row is half a byte (two a byte, the first in the high
// half; tile n's row k is half n*h+k), and a column byte is its two tiles side by side. (Nothing is kept between calls: the program is in the ROM.)
static const b8 *rom(u lo,u hi) { return (const b8 *)(0xC00+(hi<<8)+lo); }
static u rev8(u v)
{
  v=((v>>1)&0x55)|((v&0x55)<<1);
  v=((v>>2)&0x33)|((v&0x33)<<2);
  return ((v>>4)|(v<<4))&0xFF;
}
#ifndef NONARROW
// (The 4-pixel tiles are in the programs with n, see build.sh: the others are the same as before them.)
// Row k of the tile of map entry n of a description (a byte as drawn, its left pixel in bit 7; with 4-pixel tiles half a byte, its left pixel in
// bit 3), flipped left to right when the entry says so.
static u __attribute__((noinline)) tilerow(const b8 *d,u n,u k)
{
  const b8 *tiles=rom(d[2],d[3]);
  u f=(d[4]&0x80)&&(n&0x80),i,v;
  if (f) n&=0x7F;
  i=n*(d[4]&0x3F)+k;
  if (d[4]&0x40)
  {
    v=tiles[i>>1];
    v=(i&1)?(v&15):(v>>4);
    return f?(rev8(v)>>4):v;
  }
  v=tiles[i];
  return f?rev8(v):v;
}
#endif

// Function 106, a whole background: CF[1] and CF[2] = the address of its description.
static void tilesload(volatile b8 *p)
{
  const b8 *d=rom(CF[1],CF[2]);
  const b8 *map=rom(d[0],d[1]);
#ifdef NONARROW
  const b8 *tiles=rom(d[2],d[3]);
  u h=d[4]&0x7F,flips=d[4]&0x80,maprows=d[5],total=d[6]?d[6]:maprows*h;
#else
  u h=d[4]&0x3F,narrow=d[4]&0x40,maprows=d[5],total=d[6]?d[6]:maprows*h;
#endif
  u c;
  for (c=0;c<4;c++)
  {
    volatile b8 *dst=p+(c<<8);
    u r,k=0,m=0;
    for (r=0;r<total;r++)
    {
#ifdef NONARROW
      u n=map[(m<<2)+c],f=c&1,v;
      if (flips&&(n&0x80)) { n&=0x7F; f^=1; }
      v=tiles[n*h+k];
      dst[r]=f?rev8(v):v;
#else
      u v;
      if (narrow)
      {
        const b8 *e=map+(m<<3)+(c<<1);
        v=(tilerow(d,e[0],k)<<4)|tilerow(d,e[1],k);
      }
      else v=tilerow(d,map[(m<<2)+c],k);
      dst[r]=(c&1)?rev8(v):v;
#endif
      if (++k==h) { k=0; if (++m==maprows) m=0; }
    }
  }
}

// Functions 108 to 111, one tile in column 0 to 3: CF[1] and CF[2] = the address of a description with the tiles, CF[3] = the tile, CF[4] = the row of
// the memory its first row goes in (the rows after it wrap round the 256 of the queue); with 4-pixel tiles CF[5] = the half of the column (0 left, 1
// right), the other half kept.
static void tileset(volatile b8 *p,u column)
{
  const b8 *d=rom(CF[1],CF[2]);
#ifdef NONARROW
  u h=d[4]&0x7F,n=CF[3],f=column&1,k;
  const b8 *src;
  volatile b8 *dst=p+(column<<8);
  if ((d[4]&0x80)&&(n&0x80)) { n&=0x7F; f^=1; }
  src=rom(d[2],d[3])+n*h;
  for (k=0;k<h;k++) dst[(CF[4]+k)&255]=f?rev8(src[k]):src[k];
#else
  u h=d[4]&0x3F,keep=0,shift=0,k;
  volatile b8 *dst=p+(column<<8);
  if (d[4]&0x40)
  {
    if (CF[5]&1) keep=0xF0; else { keep=0x0F; shift=4; }
    if (column&1) keep=rev8(keep);
  }
  for (k=0;k<h;k++)
  {
    volatile b8 *q=dst+((CF[4]+k)&255);
    u v=tilerow(d,CF[3],k)<<shift;
    *q=(*q&keep)|((column&1)?rev8(v):v);
  }
#endif
}
#endif

#ifndef NORUNS
// The backgrounds kept as runs (generators/bbasic/pf-tiles.js, planRuns), function 112: CF[1] and CF[2] = the address of a description (as the tilemap's
// addresses are given): the address of the runs (low, high), the rows of the background, and the rows to fill (0: its rows once; more: its rows again from
// the top, the scrolling memory). The runs are each column's (byte, count) pairs, one column after the other, the bytes as the queues have them.
static const b8 *runrom(u lo,u hi) { return (const b8 *)(0xC00+(hi<<8)+lo); }
static void runsload(volatile b8 *p)
{
  const b8 *d=runrom(CF[1],CF[2]);
  const b8 *s=runrom(d[0],d[1]);
  u rows=d[2],total=d[3]?d[3]:d[2],c;
  for (c=0;c<4;c++)
  {
    volatile b8 *dst=p+(c<<8);
    const b8 *start=s;
    u r=0,k=0;
    // (Each pass reads the column's runs to the end, so the next column starts after them; the rows past the ones to fill are not written.)
    for (;;)
    {
      u v=s[0],n=s[1];
      s+=2;
      k+=n;
      while (n--) { if (r<total) dst[r]=v; r++; }
      if (k>=rows) { if (r>=total) break; s=start; k=0; }
    }
  }
}
#endif

void __attribute__((section(".text.entry"))) run(void)
{
  // The first column of the playfield: the address the kernel's first data fetcher has, in display memory (get32bitdff(0) of main.c).
  const b8 *fa=(const b8 *)(0xC00+*(volatile unsigned short *)(0xC00+0x61A0));
  volatile b8 *p=(volatile b8 *)(0x40000C00+(fa[46]<<8)+fa[38]);
  u op=CF[0];
  if (op&0x80)
  {
#ifndef NOBOX
    CF[1]=box(p);
#endif
  }
#ifndef NOCIRCLE
  else if (op>=96&&op<=98) circle(p);
#endif
#ifndef NOTERRAIN
  else if (op==113) terrain(p);
  else if (op==114) pfgravity(p);
  else if (op==115) pfgravstep(p);
#endif
#ifndef NOPIX
  else if (op==99) findpixel(p);
  else if (op==100) bouncepix(p);
#endif
#ifndef NOFIRE
  else if (op==102) firebatch(p);
#endif
#ifndef NOAUDIO
  else if (op==104) audiowave();
  else if (op==105) audiomix();
#endif
#ifndef NORUNS
  else if (op==112) runsload(p);
#endif
#ifndef NOTILES
  else if (op==106) tilesload(p);
  else if (op>=108&&op<=111) tileset(p,op-108);
#endif
  else
  {
#ifndef NOOFFSET
    offset(p);
#endif
  }
}
