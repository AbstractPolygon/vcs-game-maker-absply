 ; vcs-game-maker: the two-tone 48x2 graphic (DPC+): a left and a right color for every row, the way the AtariAge logo draws its text.
 ; The six columns are drawn inverted in the page's background color (the players' colors), so the colors show through their holes: on the
 ; left the playfield (PF2 lit, COLUPF the row's left color, the ball 8 wide carrying it to the middle), on the right the background
 ; (COLUBK the row's right color, written just before the four timed stores). After the stores COLUBK and COLUPF go back to the page's
 ; color (so the right copy of PF2 and the background past the graphic do not show). The missiles, 8 wide in the players' color, hide the
 ; edges. The card's entry (made by the build, draw_bmp_48x2_N) copies its lists into the display memory the DPC+ kernel fills again every
 ; frame (from P1GFX: the six columns, the left and the right colors, a byte a row from the top) and fills a list of the page's color
 ; (two bytes a row, for data fetcher 0), points the fractional fetchers 0 to 7 at the eight lists going on half a byte a read (each byte is
 ; read on both lines of its row), puts the page's color in temp2 and the rows in X and comes here.
 ; The bytes are read with fast fetch (lda # of a fetcher's number: 2 cycles), which leaves the time for the colors of every row. The timing
 ; is the AtariAge text loop's: a line starts at cycle 68 of the line before, the four stores end at cycles 45, 48, 51 and 54, COLUBK
 ; is written at 39.

draw_bmp_48x2_T
	; (The stack pointer counts the rows in the loop: it is kept in stack1.)
	stx temp1
	tsx
	stx stack1

	; The players and the missiles as the AtariAge positioning has them: three copies close, the missiles 8 wide, all in the page's color.
	ldx #0
	stx GRP0
	stx GRP1
	stx GRP0
	stx ENAM0
	stx ENAM1
	stx ENABL
	stx PF0
	stx PF1
	ldx temp2
	stx COLUP0
	stx COLUP1
	stx COLUPF
	ldx #%110011
	stx NUSIZ0
	stx NUSIZ1
	ldx #$FF
	stx PF2

	sta WSYNC
	SLEEP 17		;   (17)
	stx VDELP0		;3 (20)
	ldx #$4f		;2 (22)
	SLEEP 3			;   (25)
	sta RESM0		;3 (28)
	stx VDELP1		;3 (31)
	stx HMP0		;3 (34)
	stx HMM0		;3 (37)
	sta.w RESP0		;4 (41)
	sta RESP1		;3 (44)
	sta RESBL		;3 (47)
	stx HMBL		;3 (50)
	inx			;2 (52)
	sta RESM1		;3 (55)
	stx HMP1		;3 (58)
	ldx #$d0		;2 (60)
	stx HMM1		;3 (63)
	ldx #$5f		;2 (65)	the ball a pixel further left than the AtariAge logo has it: the left color ends with the third column
	stx HMBL		;3 (68)
	sta WSYNC
	sta HMOVE		;3 (3)

	; The ball 8 wide, the masks on, fast fetch on; then to cycle 68 and the loop.
	ldx #%110000		;2 (5)
	stx CTRLPF		;3 (8)
	ldx #2			;2 (10)
	stx ENAM0		;3 (13)
	stx ENAM1		;3 (16)
	stx ENABL		;3 (19)
	ldx #0			;2 (21)
	stx FASTFETCH		;4 (25)
	ldx temp1		;3 (28)
	txs			;2 (30)
	stx HMCLR		;3 (33)
	SLEEP 32		;   (65)
	jmp pf48x2_T_loop	;3 (68)

 ; (The loop is $6D bytes: its start and the byte after its bne on one page, or the branch takes a cycle more and every row starts a cycle later than
 ; the one before, which smears the graphic to the right.)
 if >. != >[.+$6D]
	align 256
 endif
pf48x2_T_loop
	; The first line of a row (from cycle 68 of the line before).
	lda #<DF0FRACDATA	;2	the first column
	sta GRP0		;3
	lda #<DF1FRACDATA	;2
	sta GRP1		;3
	lda #<DF2FRACDATA	;2
	sta GRP0		;3 (7)
	lda #<DF6FRACDATA	;2	the left color of the row
	sta COLUPF		;3 (12)
	lda #<DF5FRACDATA	;2	the sixth column
	sta stack2		;3 (17)
	lda #<DF4FRACDATA	;2	the fifth
	tay			;2 (21)
	lda #<DF7FRACDATA	;2	the right color
	tax			;2 (25)
	lda #<DF3FRACDATA	;2 (27)	the fourth
	SLEEP 9			;  (36)
	stx COLUBK		;3 (39)
	ldx stack2		;3 (42)
	sta GRP1		;3 (45)
	sty GRP0		;3 (48)
	stx GRP1		;3 (51)
	sta GRP0		;3 (54)
	lda #<DF0DATA		;2 (56)	the page's color
	sta COLUBK		;3 (59)
	sta COLUPF		;3 (62)
	tsx			;2 (64)
	dex			;2 (66)
	txs			;2 (68)
	; The second line of the row (the same bytes: the fractional fetchers read each one twice).
	lda #<DF0FRACDATA	;2
	sta GRP0		;3
	lda #<DF1FRACDATA	;2
	sta GRP1		;3
	lda #<DF2FRACDATA	;2
	sta GRP0		;3 (7)
	lda #<DF6FRACDATA	;2
	sta COLUPF		;3 (12)
	lda #<DF5FRACDATA	;2
	sta stack2		;3 (17)
	lda #<DF4FRACDATA	;2
	tay			;2 (21)
	lda #<DF7FRACDATA	;2
	tax			;2 (25)
	lda #<DF3FRACDATA	;2 (27)
	SLEEP 9			;  (36)
	stx COLUBK		;3 (39)
	ldx stack2		;3 (42)
	sta GRP1		;3 (45)
	sty GRP0		;3 (48)
	stx GRP1		;3 (51)
	sta GRP0		;3 (54)
	lda #<DF0DATA		;2 (56)
	sta COLUBK		;3 (59)
	sta.w COLUPF		;4 (63)
	tsx			;2 (65)
	bne pf48x2_T_loop	;3 (68)
 if >pf48x2_T_loop != >.
	echo "ERROR: the two-tone 48x2 loop crosses a page"
	err
 endif

	ldx #255
	stx FASTFETCH
	ldx #0
	stx GRP0
	stx GRP1
	stx GRP0
	stx GRP1
	stx ENAM0
	stx ENAM1
	stx ENABL
	stx VDELP0
	stx VDELP1
	stx PF0
	stx PF1
	stx PF2
	ldx temp2
	stx COLUBK
	stx COLUPF
	ldx stack1
	txs
	rts
