@echo off
set KIVY_GL_BACKEND=gl
set KIVY_WINDOW=sdl2
set SDL_VIDEO_RENDERER=software
python farm_game.py
pause