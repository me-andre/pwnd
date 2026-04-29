# Pawn and Dude
## Чувак и Пешка

A chess-inspired game with familiar rules except that all non-pawn pieces are replaced by "undefined" dude pieces. Dude are pieces in "superposition" and they "collapse" into some of the standard chess pieces by "revealing" who they are when player moves them one or another way. When the dude piece is moved, all pieces types that couldn't make such move are removed from the set of possible dude roles until only one role/piece type is left.
Examples:
1. A dude moves from A1 to B3 - only a knight can make such move, so the dude piece becomes a knight.
2. 7 out of 8 dudes became non-king pieces, making 8th piece transition into a king automatically.
3. The opponent gives check to a dude piece, making it a candidate for a king; if there are more dudes to still potentially become kings, this "king candidate" can move as another piece to transition into a non-king, evading the check.
4. A dude moves from A1 to B2 - now it's a bishop/queen/king type of dude, the final type is not defined yet.